/**
 * cache.service.ts — 三层缓存服务
 *
 * L1 Memory (Context/State) → L2 AsyncStorage (持久化) → L3 Supabase (远程)
 *
 * 读取: cache-aside 模式（L1 → L2 → L3）
 * 写入: write-through 模式（L3 → L2 → L1）
 */

import {
  CacheConfig,
  CacheEntry,
  getCacheConfig,
  isCacheExpired,
  isCacheStale,
} from './cacheConfig';
import {
  putCacheEntry,
  getCacheEntry,
  removeCacheEntry,
  putCacheEntries,
  getCacheEntries,
  checkStorageThreshold,
  clearAllCache,
} from './storage.service';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// L1 内存缓存
// ---------------------------------------------------------------------------

interface MemoryCacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  ttl: number;
}

class MemoryCache {
  private store: Map<string, MemoryCacheEntry> = new Map();
  private maxSize = 50; // 最多缓存 50 个 key

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    // LRU 淘汰：超过上限时删除最旧的
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()].sort(
        (a, b) => a[1].cachedAt - b[1].cachedAt,
      )[0];
      if (oldest) this.store.delete(oldest[0]);
    }

    this.store.set(key, { data, cachedAt: Date.now(), ttl });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key) && !isCacheExpired({
      key,
      data: null,
      cachedAt: this.store.get(key)?.cachedAt ?? 0,
      ttl: this.store.get(key)?.ttl ?? 0,
    });
  }
}

export const memoryCache = new MemoryCache();

// ---------------------------------------------------------------------------
// 三级缓存读取器
// ---------------------------------------------------------------------------

/**
 * 三级缓存读取：L1 → L2 → L3。
 *
 * @param key - 缓存键
 * @param fetchFromRemote - 从远程（Supabase）获取数据的函数
 * @param options - 可选配置
 */
export async function cacheRead<T>(
  key: string,
  fetchFromRemote: () => Promise<T>,
  options?: {
    /** 强制跳过缓存，直接从远程获取 */
    forceRefresh?: boolean;
    /** 如果缓存过期，是否自动后台刷新 */
    backgroundRefresh?: boolean;
    /** 自定义缓存配置 */
    config?: Partial<CacheConfig>;
  },
): Promise<{ data: T; source: 'memory' | 'storage' | 'remote' }> {
  const config = { ...getCacheConfig(key), ...options?.config };

  // 如果强制刷新，直接走远程
  if (options?.forceRefresh) {
    const data = await fetchFromRemote();
    await cacheWrite(key, data, config);
    return { data, source: 'remote' };
  }

  // L1: 内存缓存
  const memData = memoryCache.get<T>(key);
  if (memData !== null) {
    // 检查是否软过期，需要后台刷新
    const isStale = isCacheStale({
      key,
      data: memData,
      cachedAt: 0, // 无法从内存获取, 用保守值
      ttl: config.ttl,
    });
    if (isStale && options?.backgroundRefresh !== false) {
      // 异步后台刷新，不阻塞返回
      fetchFromRemote()
        .then((fresh) => cacheWrite(key, fresh, config))
        .catch((e) =>
          logger.debug('[cache] background refresh failed (memory)', {
            key,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
    }
    return { data: memData, source: 'memory' };
  }

  // L2: AsyncStorage 持久化缓存
  const storageEntry = await getCacheEntry<T>(config);
  if (storageEntry && !isCacheExpired(storageEntry)) {
    // 回填 L1
    memoryCache.set(key, storageEntry.data, config.ttl);

    // 检查软过期
    if (isCacheStale(storageEntry) && options?.backgroundRefresh !== false) {
      fetchFromRemote()
        .then((fresh) => cacheWrite(key, fresh, config))
        .catch((e) =>
          logger.debug('[cache] background refresh failed (storage)', {
            key,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
    }

    return { data: storageEntry.data, source: 'storage' };
  }

  // L3: 远程获取
  const data = await fetchFromRemote();

  // 回写 L2 + L1
  await cacheWrite(key, data, config);

  return { data, source: 'remote' };
}

/**
 * 三级缓存写入：L3 成功 → L2 → L1。
 */
export async function cacheWrite<T>(
  key: string,
  data: T,
  config?: Partial<CacheConfig>,
): Promise<void> {
  const fullConfig = { ...getCacheConfig(key), ...config };

  // 写入 L2
  await putCacheEntry(fullConfig, data);

  // 写入 L1
  memoryCache.set(key, data, fullConfig.ttl);

  // 检查存储阈值
  await checkStorageThreshold();
}

/**
 * 缓存失效（清除指定 key 的所有缓存层）。
 */
export async function cacheInvalidate(key: string): Promise<void> {
  memoryCache.delete(key);
  await removeCacheEntry(key);
}

/**
 * 缓存预热：将指定 key 的数据从 L2 加载到 L1。
 */
export async function cacheWarmup(key: string): Promise<void> {
  const config = getCacheConfig(key);
  const entry = await getCacheEntry(config);
  if (entry) {
    memoryCache.set(key, entry.data, config.ttl);
  }
}

/**
 * 批量缓存读取（用于列表数据）。
 */
export async function cacheReadList<T>(
  key: string,
  fetchFromRemote: () => Promise<T[]>,
  options?: Parameters<typeof cacheRead>[2],
): Promise<{ data: T[]; source: 'memory' | 'storage' | 'remote' }> {
  return cacheRead<T[]>(key, fetchFromRemote, options);
}

/**
 * 清空所有缓存层。
 */
export async function cacheClearAll(): Promise<void> {
  memoryCache.clear();
  await clearAllCache();
}

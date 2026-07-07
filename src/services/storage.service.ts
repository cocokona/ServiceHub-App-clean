/**
 * storage.service.ts — 本地持久化存储抽象层
 *
 * 基于 AsyncStorage 实现，提供：
 * - 带 TTL 的缓存读写
 * - LRU 淘汰机制
 * - 存储容量管理
 * - 批量操作与逐出策略
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CacheEntry,
  CacheStats,
  CacheConfig,
  STORAGE_LIMITS,
  isCacheExpired,
} from './cacheConfig';

// ---------------------------------------------------------------------------
// 存储键前缀
// ---------------------------------------------------------------------------

const PREFIX = 'sh_cache:';
const META_KEY = `${PREFIX}__meta__`;

interface StorageMeta {
  /** 各 key 的条目数 */
  entryCounts: Record<string, number>;
  /** 各 key 的最后访问时间 */
  lastAccess: Record<string, number>;
  /** 估算总大小（字节） */
  estimatedTotalSize: number;
  /** 最后清理时间 */
  lastCleanup: number;
}

// ---------------------------------------------------------------------------
// LRU 访问顺序追踪（内存中）
// ---------------------------------------------------------------------------

class LRUTracker {
  private accessOrder: Map<string, number> = new Map();

  touch(key: string): void {
    this.accessOrder.delete(key);
    this.accessOrder.set(key, Date.now());
  }

  getLeastRecentlyUsed(count: number): string[] {
    const sorted = [...this.accessOrder.entries()]
      .sort((a, b) => a[1] - b[1]);
    return sorted.slice(0, count).map(([key]) => key);
  }

  remove(key: string): void {
    this.accessOrder.delete(key);
  }

  clear(): void {
    this.accessOrder.clear();
  }

  size(): number {
    return this.accessOrder.size;
  }
}

const lruTracker = new LRUTracker();

// ---------------------------------------------------------------------------
// 元数据管理
// ---------------------------------------------------------------------------

async function loadMeta(): Promise<StorageMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // 元数据损坏，重建
  }
  return createDefaultMeta();
}

function createDefaultMeta(): StorageMeta {
  return {
    entryCounts: {},
    lastAccess: {},
    estimatedTotalSize: 0,
    lastCleanup: Date.now(),
  };
}

async function saveMeta(meta: StorageMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

function estimateSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length * 2; // UTF-16 估算
  }
}

// ---------------------------------------------------------------------------
// 核心读写 API
// ---------------------------------------------------------------------------

/**
 * 写入缓存条目。
 */
export async function putCacheEntry<T>(
  config: CacheConfig,
  data: T,
): Promise<void> {
  const storageKey = `${PREFIX}${config.key}`;
  const entry: CacheEntry<T> = {
    key: config.key,
    data,
    cachedAt: Date.now(),
    ttl: config.ttl,
  };

  const serialized = JSON.stringify(entry);
  const size = estimateSize(entry);

  // 容量检查
  let meta = await loadMeta();
  const { estimatedTotalSize } = meta;

  if (estimatedTotalSize + size > STORAGE_LIMITS.TOTAL_QUOTA * STORAGE_LIMITS.CRITICAL_THRESHOLD) {
    await evictEntries(meta, size);
    meta = await loadMeta(); // 重新加载更新后的元数据
  }

  await AsyncStorage.setItem(storageKey, serialized);

  // 更新元数据
  meta.entryCounts[config.key] = (meta.entryCounts[config.key] || 0) + 1;
  meta.lastAccess[config.key] = Date.now();
  meta.estimatedTotalSize += size;
  await saveMeta(meta);

  lruTracker.touch(storageKey);
}

/**
 * 读取缓存条目（自动检查 TTL）。
 */
export async function getCacheEntry<T>(
  config: CacheConfig,
): Promise<CacheEntry<T> | null> {
  const storageKey = `${PREFIX}${config.key}`;

  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    // 检查是否过期
    if (isCacheExpired(entry)) {
      // 后台异步清理，不阻塞读取
      removeCacheEntry(config.key).catch(() => {});
      return null;
    }

    // 更新最后访问时间
    lruTracker.touch(storageKey);
    const meta = await loadMeta();
    meta.lastAccess[config.key] = Date.now();
    await saveMeta(meta);

    return entry;
  } catch {
    // 数据损坏
    await removeCacheEntry(config.key);
    return null;
  }
}

/**
 * 删除缓存条目。
 */
export async function removeCacheEntry(key: string): Promise<void> {
  const storageKey = `${PREFIX}${key}`;
  await AsyncStorage.removeItem(storageKey);
  lruTracker.remove(storageKey);

  const meta = await loadMeta();
  delete meta.entryCounts[key];
  delete meta.lastAccess[key];
  await saveMeta(meta);
}

/**
 * 批量写入缓存条目（用于列表数据）。
 */
export async function putCacheEntries<T>(
  config: CacheConfig,
  entries: T[],
): Promise<void> {
  // 对于列表数据，整个列表作为一个缓存条目存储
  await putCacheEntry(config, entries);
}

/**
 * 批量读取缓存条目。
 */
export async function getCacheEntries<T>(
  config: CacheConfig,
): Promise<CacheEntry<T[]> | null> {
  return getCacheEntry<T[]>(config);
}

// ---------------------------------------------------------------------------
// LRU 淘汰 & 容量管理
// ---------------------------------------------------------------------------

/**
 * 淘汰条目以释放指定空间。
 */
async function evictEntries(meta: StorageMeta, neededSize: number): Promise<void> {
  const keysToEvict = lruTracker.getLeastRecentlyUsed(20); // 每次最多淘汰 20 条

  for (const storageKey of keysToEvict) {
    if (meta.estimatedTotalSize < STORAGE_LIMITS.TOTAL_QUOTA * STORAGE_LIMITS.WARNING_THRESHOLD) {
      break; // 已降到预警阈值以下
    }

    const key = storageKey.replace(PREFIX, '');
    // 不淘汰核心数据
    if ((STORAGE_LIMITS.CORE_KEYS as readonly string[]).includes(key)) continue;

    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const entrySize = raw ? estimateSize(JSON.parse(raw)) : 0;

      await AsyncStorage.removeItem(storageKey);
      lruTracker.remove(storageKey);

      delete meta.entryCounts[key];
      meta.estimatedTotalSize -= entrySize;
    } catch {
      // 单个条目淘汰失败，继续下一个
    }
  }

  await saveMeta(meta);
}

/**
 * 获取存储使用情况统计。
 */
export async function getStorageStats(): Promise<{
  totalSize: number;
  percentUsed: number;
  entries: CacheStats[];
  threshold: 'normal' | 'warning' | 'critical' | 'emergency' | 'full';
}> {
  const meta = await loadMeta();
  const percentUsed = meta.estimatedTotalSize / STORAGE_LIMITS.TOTAL_QUOTA;

  let threshold: 'normal' | 'warning' | 'critical' | 'emergency' | 'full' = 'normal';
  if (percentUsed >= 1) threshold = 'full';
  else if (percentUsed >= STORAGE_LIMITS.EMERGENCY_THRESHOLD) threshold = 'emergency';
  else if (percentUsed >= STORAGE_LIMITS.CRITICAL_THRESHOLD) threshold = 'critical';
  else if (percentUsed >= STORAGE_LIMITS.WARNING_THRESHOLD) threshold = 'warning';

  const entries: CacheStats[] = Object.entries(meta.entryCounts).map(
    ([key, count]) => ({
      key,
      entryCount: count,
      estimatedSize: 0, // 需要逐条计算，此处省略
      oldestEntry: 0,
      newestEntry: meta.lastAccess[key] || 0,
    }),
  );

  return {
    totalSize: meta.estimatedTotalSize,
    percentUsed: Math.round(percentUsed * 100) / 100,
    entries,
    threshold,
  };
}

/**
 * 清理所有过期缓存。
 */
export async function cleanExpiredCache(): Promise<number> {
  const meta = await loadMeta();
  let cleaned = 0;

  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(PREFIX) && k !== META_KEY);

  for (const storageKey of cacheKeys) {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) continue;

      const entry: CacheEntry = JSON.parse(raw);
      if (isCacheExpired(entry)) {
        await AsyncStorage.removeItem(storageKey);
        lruTracker.remove(storageKey);
        cleaned++;
      }
    } catch {
      // 损坏数据直接清除
      await AsyncStorage.removeItem(storageKey);
      lruTracker.remove(storageKey);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    const meta = await loadMeta();
    meta.estimatedTotalSize = 0; // 强制重建
    meta.lastCleanup = Date.now();
    await saveMeta(meta);
  }

  return cleaned;
}

/**
 * 清除指定 key 的所有缓存。
 */
export async function clearCacheByKey(key: string): Promise<void> {
  await removeCacheEntry(key);
}

/**
 * 清空所有缓存。
 */
export async function clearAllCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));

  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }

  lruTracker.clear();
  await saveMeta(createDefaultMeta());
}

/**
 * 紧急清理 — 只保留核心数据。
 */
export async function emergencyCleanup(): Promise<void> {
  const meta = await loadMeta();
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(
    (k) =>
      k.startsWith(PREFIX) &&
      k !== META_KEY &&
      !(STORAGE_LIMITS.CORE_KEYS as readonly string[]).some((core) => k === `${PREFIX}${core}`),
  );

  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }

  // 更新元数据
  for (const key of cacheKeys) {
    const plainKey = key.replace(PREFIX, '');
    delete meta.entryCounts[plainKey];
  }
  meta.estimatedTotalSize = 0;
  meta.lastCleanup = Date.now();
  await saveMeta(meta);
}

/**
 * 检查存储阈值并执行相应操作。
 * 返回当前阈值级别。
 */
export async function checkStorageThreshold(): Promise<
  'normal' | 'warning' | 'critical' | 'emergency' | 'full'
> {
  const stats = await getStorageStats();

  if (stats.threshold === 'critical') {
    // 自动清理图片缓存（保留最近 7 天）
    await cleanExpiredCache();
  }

  if (stats.threshold === 'emergency' || stats.threshold === 'full') {
    await emergencyCleanup();
  }

  return stats.threshold;
}

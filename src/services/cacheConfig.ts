/**
 * cacheConfig.ts — 缓存配置注册中心
 *
 * 统一管理所有数据类型的缓存策略（TTL、粒度、淘汰、离线兜底）。
 * 新增数据类型只需在 src/data/files/cache-config.json 中注册。
 *
 * 配置数据从 JSON 文件加载，修改配置无需改动源码。
 */

import cacheConfigData from '../data/files/cache-config.json';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type Granularity = 'full' | 'incremental';
export type EvictionStrategy = 'lru' | 'fifo' | 'none';
export type OfflineFallback = 'cache' | 'placeholder' | 'empty';

export interface CacheConfig {
  key: string;
  ttl: number;
  granularity: Granularity;
  eviction: EvictionStrategy;
  offlineFallback: OfflineFallback;
  maxEntries?: number;
  warmupOnStart?: boolean;
}

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  cachedAt: number;
  ttl: number;
  etag?: string;
  version?: number;
}

export interface CacheStats {
  key: string;
  entryCount: number;
  estimatedSize: number;
  oldestEntry: number;
  newestEntry: number;
}

// ---------------------------------------------------------------------------
// 缓存注册表 — 从 JSON 加载
// ---------------------------------------------------------------------------

export const DEFAULT_CACHE_TTL: Record<string, number> = cacheConfigData.defaultTtl as Record<string, number>;

const cacheRegistry: Record<string, CacheConfig> = cacheConfigData.registry as Record<string, CacheConfig>;

// ---------------------------------------------------------------------------
// 存储器容量管理常量 — 从 JSON 加载
// ---------------------------------------------------------------------------

const _limits = cacheConfigData.storageLimits;

export const STORAGE_LIMITS = {
  TOTAL_QUOTA: _limits.totalQuota,
  WARNING_THRESHOLD: _limits.warningThreshold,
  CRITICAL_THRESHOLD: _limits.criticalThreshold,
  EMERGENCY_THRESHOLD: _limits.emergencyThreshold,
  CORE_KEYS: _limits.coreKeys,
  IMAGE_CACHE_RETENTION_DAYS: _limits.imageCacheRetentionDays,
} as const;

// ---------------------------------------------------------------------------
// 默认配置 — 从 JSON 加载
// ---------------------------------------------------------------------------

const _defaultCfg = cacheConfigData.defaultConfig;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * 获取指定 key 的缓存配置。
 * 如果 key 未注册，返回默认配置。
 */
export function getCacheConfig(key: string): CacheConfig {
  if (cacheRegistry[key]) {
    return { ...cacheRegistry[key] };
  }
  return {
    key,
    ttl: _defaultCfg.ttl,
    granularity: _defaultCfg.granularity as Granularity,
    eviction: _defaultCfg.eviction as EvictionStrategy,
    offlineFallback: _defaultCfg.offlineFallback as OfflineFallback,
    maxEntries: _defaultCfg.maxEntries,
  };
}

/**
 * 获取所有已注册的缓存键。
 */
export function getRegisteredKeys(): string[] {
  return Object.keys(cacheRegistry);
}

/**
 * 判断缓存条目是否过期。
 */
export function isCacheExpired(entry: CacheEntry): boolean {
  if (entry.ttl <= 0) return true;
  return Date.now() - entry.cachedAt > entry.ttl;
}

/**
 * 判断缓存条目是否过期（软过期 — 仍可使用但需后台刷新）。
 */
export function isCacheStale(entry: CacheEntry): boolean {
  if (entry.ttl <= 0) return true;
  return Date.now() - entry.cachedAt > entry.ttl * 0.8;
}

/**
 * 获取缓存 TTL（毫秒）。
 */
export function getCacheTTL(key: string): number {
  return getCacheConfig(key).ttl;
}

/**
 * 注册/覆盖缓存配置（用于运行时动态扩展）。
 */
export function registerCacheConfig(config: CacheConfig): void {
  (cacheRegistry as Record<string, CacheConfig>)[config.key] = config;
}

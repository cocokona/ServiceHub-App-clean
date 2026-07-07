/**
 * services/index.ts — 服务层统一导出
 */

// 缓存
export {
  getCacheConfig,
  getRegisteredKeys,
  isCacheExpired,
  isCacheStale,
  registerCacheConfig,
  STORAGE_LIMITS,
} from './cacheConfig';
export type { CacheConfig, CacheEntry, Granularity, EvictionStrategy, OfflineFallback } from './cacheConfig';

export { memoryCache, cacheRead, cacheWrite, cacheInvalidate, cacheWarmup, cacheClearAll } from './cache.service';

// 存储
export {
  putCacheEntry,
  getCacheEntry,
  removeCacheEntry,
  getStorageStats,
  cleanExpiredCache,
  clearAllCache,
  emergencyCleanup,
  checkStorageThreshold,
} from './storage.service';

// 网络
export {
  initNetworkService,
  destroyNetworkService,
  getNetworkInfo,
  isOnline,
  isOffline,
  isWeak,
  subscribeNetwork,
  refreshNetworkStatus,
} from './network.service';
export type { NetworkInfo, NetworkStatus } from './network.service';

// 同步配置
export {
  getSyncRule,
  getRegisteredSyncKeys,
  getSyncKeysByPriority,
  registerSyncRule,
  resolveConflict,
  DEFAULT_RETRY_CONFIG,
} from './syncConfig';
export type { SyncRule, SyncQueueItem, SyncResult, ConflictStrategy } from './syncConfig';

// 同步队列
export {
  enqueueSyncOperation,
  dequeueSyncOperation,
  getSyncQueueSize,
  clearSyncQueue,
  flushSyncQueue,
  getSyncQueueStats,
} from './syncQueue.service';

// 同步服务
export {
  initSyncService,
  destroySyncService,
  performFullSync,
  syncByKey,
  getSyncState,
  subscribeSync,
  triggerManualSync,
} from './sync.service';
export type { SyncState, SyncStatus } from './sync.service';

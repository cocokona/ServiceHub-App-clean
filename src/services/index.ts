/**
 * services/index.ts — 服务层统一导出
 */

// 日志 & 错误处理
export { logger, generateTraceId } from './logger';
export type { LogLevel, LogEntry, LogSink, LogMeta } from './logger';
export { logAndThrow, isForeignKeyViolation } from './errors';
export type { DbErrorLike } from './errors';

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

// 支付（客户支付方式管理，仅存储 tokenized 记录 + RLS 私有）
export {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  detectCardBrand,
  luhnValid,
  formatCardNumber,
  normalizeExpiry,
  isExpiryValid,
} from './payment.service';

// 地址（客户资料与下单表单共享的字段结构 / 校验 / 格式化）
export {
  ADDRESS_FIELDS,
  ADDRESS_FIELD_KEYS,
  emptyAddressFields,
  validateAddressFields,
  formatAddress,
  profileToAddressFields,
  addressFieldsToProfile,
} from './address';
export type { AddressFields, AddressFieldConfig, AddressValidation } from './address';

// 资料校验（下单地址 + 电话、接单电话、拨号归一化、显示名、电话唯一性）
export {
  validateCustomerOrderProfile,
  validateTechnicianAcceptProfile,
  validateTechnicianCanAcceptJob,
  normalizePhoneForDial,
  validateDisplayName,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  normalizePhone,
  validatePhoneUniqueness,
  phoneUniquenessErrorMessage,
} from './validation';
export type { ProfileRole, PhoneUniquenessValidation } from './validation';

// 电话唯一性（按角色分组：同角色不可重复，跨角色允许重叠）
export { checkPhoneUniquenessWithinRole } from './phone.service';
export type { PhoneUniquenessCheck } from './phone.service';

// 评价（订单完成后客户对技师打分 + 文本评价，服务端触发器实时汇总）
export {
  submitReview,
  fetchTechnicianReviews,
  fetchTopReview,
  fetchReviewForJob,
  fetchTechnicianStats,
} from './review.service';
export type { SubmitReviewInput, TechnicianReviewStats } from './review.service';

// 头像上传（Supabase Storage: avatars 桶，按用户目录隔离 + RLS）
export {
  uploadProfilePicture,
  removeProfilePicture,
  AVATAR_BUCKET,
  AVATAR_TARGET_SIZE,
} from './profilePicture.service';

// 自动取消（30 分钟内未被技师接单的「当天」订单）
export {
  AUTO_CANCEL_TIMEOUT_MINUTES,
  isSameDayOrder,
  getAutoCancelDeadline,
  isAutoCancelEligible,
  getAutoCancelRemainingMs,
  autoCancelUnacceptedOrders,
} from './autoCancel.service';
export type { AutoCancelOrderInput } from './autoCancel.service';

// 持久化计时器（时间戳锚点：息屏 / 后台 / 进程被杀后重新打开均准确续算）
export { PersistentTimer, formatDuration } from './timer.service';
export type {
  TimerMode,
  TimerStatus,
  TimerSnapshot,
  ComputedTimer,
  PersistentTimerOptions,
} from './timer.service';

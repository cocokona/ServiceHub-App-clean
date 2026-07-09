/**
 * syncConfig.ts — 同步规则配置注册中心
 *
 * 统一管理各数据类型的：
 * - 增量同步字段
 * - 冲突解决策略
 * - 队列优先级
 * - 重试配置
 *
 * 配置数据从 JSON 文件加载，修改配置无需改动源码。
 * 新增数据类型只需在 src/data/files/sync-config.json 中注册。
 */

import syncConfigData from '../data/files/sync-config.json';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type ConflictStrategy = 'last_write_wins' | 'merge' | 'optimistic_lock';
export type SyncPriority = 'high' | 'normal' | 'low';

export interface SyncRule {
  /** 数据类型 key */
  key: string;
  /** 增量同步字段（通常是 updated_at） */
  incrementField: string;
  /** Supabase 表名 */
  tableName: string;
  /** 冲突解决策略 */
  conflictStrategy: ConflictStrategy;
  /** 队列处理优先级 */
  priority: SyncPriority;
  /** 是否支持实时订阅 */
  realtimeEnabled: boolean;
  /** 最大批量同步条数 */
  batchSize: number;
}

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 各次重试的延迟（毫秒） */
  delays: number[];
  /** 各次重试的超时（毫秒） */
  timeouts: number[];
}

export interface SyncQueueItem {
  id: string;
  key: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: number;
  retries: number;
  priority?: SyncPriority;
  lastError?: string;
}

export interface SyncResult {
  key: string;
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
  duration: number;
}

// ---------------------------------------------------------------------------
// 默认重试配置 — 从 JSON 加载（3 次 + 放弃）
// ---------------------------------------------------------------------------

const _retryData = syncConfigData.retryConfig as RetryConfig;

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: _retryData.maxRetries,
  delays: _retryData.delays,
  timeouts: _retryData.timeouts,
};

// ---------------------------------------------------------------------------
// 同步规则注册表 — 从 JSON 加载
// ---------------------------------------------------------------------------

const syncRegistry: Record<string, SyncRule> = syncConfigData.registry as Record<string, SyncRule>;

// ---------------------------------------------------------------------------
// 同步队列持久化键 — 从 JSON 加载
// ---------------------------------------------------------------------------

export const SYNC_QUEUE_KEY: string = syncConfigData.queueKey;
export const LAST_SYNC_KEY: string = syncConfigData.lastSyncKey;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * 获取指定 key 的同步规则。
 */
export function getSyncRule(key: string): SyncRule | null {
  return syncRegistry[key] || null;
}

/**
 * 获取所有已注册的同步 key。
 */
export function getRegisteredSyncKeys(): string[] {
  return Object.keys(syncRegistry);
}

/**
 * 获取所有需要增量同步的 key。
 */
export function getIncrementalKeys(): string[] {
  return Object.keys(syncRegistry).filter(
    (k) => syncRegistry[k].incrementField,
  );
}

/**
 * 获取所有需要实时订阅的 key。
 */
export function getRealtimeKeys(): string[] {
  return Object.keys(syncRegistry).filter(
    (k) => syncRegistry[k].realtimeEnabled,
  );
}

/**
 * 按优先级排序的同步 key 列表。
 */
export function getSyncKeysByPriority(): string[] {
  const priorityOrder: Record<SyncPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };

  return [...Object.keys(syncRegistry)].sort(
    (a, b) => priorityOrder[syncRegistry[a].priority] - priorityOrder[syncRegistry[b].priority],
  );
}

/**
 * 注册/覆盖同步规则。
 */
export function registerSyncRule(rule: SyncRule): void {
  (syncRegistry as Record<string, SyncRule>)[rule.key] = rule;
}

/**
 * 根据冲突策略解决冲突。
 * 当前实现: last_write_wins（时间戳优先）。
 */
export function resolveConflict<T extends { updated_at?: string; created_at?: string }>(
  local: T,
  remote: T,
  strategy: ConflictStrategy,
): T {
  switch (strategy) {
    case 'last_write_wins': {
      const localTime = local.updated_at || local.created_at || '';
      const remoteTime = remote.updated_at || remote.created_at || '';
      return remoteTime >= localTime ? remote : local;
    }
    case 'merge': {
      // 逐条合并，远程字段覆盖本地
      return { ...local, ...remote };
    }
    case 'optimistic_lock': {
      // version CAS — 远程优先
      return remote;
    }
    default:
      return remote;
  }
}

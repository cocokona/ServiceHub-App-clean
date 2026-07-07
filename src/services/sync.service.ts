/**
 * sync.service.ts — 数据同步编排器
 *
 * 核心职责：
 * - 在线/离线状态切换处理
 * - 增量同步拉取（基于 last_sync_at 时间戳）
 * - 离线队列批量同步
 * - 冲突检测与解决
 * - 同步状态事件广播
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { cacheWrite, cacheInvalidate } from './cache.service';
import { isOnline, subscribeNetwork, NetworkInfo } from './network.service';
import {
  getSyncRule,
  getSyncKeysByPriority,
  resolveConflict,
  LAST_SYNC_KEY,
  SyncResult,
  SyncQueueItem,
} from './syncConfig';
import {
  loadSyncQueue,
  flushSyncQueue,
  getSyncQueueStats,
} from './syncQueue.service';

// ---------------------------------------------------------------------------
// 同步状态类型
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  queueSize: number;
  isOnline: boolean;
  currentSyncKey: string | null;
  progress: number; // 0-1
  error: string | null;
}

type SyncListener = (state: SyncState) => void;

// ---------------------------------------------------------------------------
// 初始状态
// ---------------------------------------------------------------------------

let syncState: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  queueSize: 0,
  isOnline: true,
  currentSyncKey: null,
  progress: 0,
  error: null,
};

const listeners: Set<SyncListener> = new Set();

function updateSyncState(partial: Partial<SyncState>): void {
  syncState = { ...syncState, ...partial };
  notifySyncListeners();
}

function notifySyncListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn({ ...syncState });
    } catch {
      // 忽略异常
    }
  });
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

let networkUnsubscribe: (() => void) | null = null;
let isInitialized = false;

/**
 * 初始化同步服务。
 * 应在应用启动时调用。
 */
export async function initSyncService(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  // 加载上次同步时间
  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  if (lastSyncRaw) {
    syncState.lastSyncAt = parseInt(lastSyncRaw, 10);
  }

  // 加载队列大小
  const stats = await getSyncQueueStats();
  updateSyncState({ queueSize: stats.total });

  // 订阅网络变化
  networkUnsubscribe = subscribeNetwork(async (info: NetworkInfo) => {
    const wasOffline = !syncState.isOnline;
    const isNowOnline = info.isConnected;

    updateSyncState({
      isOnline: isNowOnline,
      status: isNowOnline ? (wasOffline ? 'syncing' : syncState.status) : 'offline',
    });

    // 从离线恢复到在线：自动批量同步
    if (wasOffline && isNowOnline) {
      await performFullSync();
    }
  });
}

/**
 * 销毁同步服务。
 */
export function destroySyncService(): void {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
  listeners.clear();
  isInitialized = false;
}

// ---------------------------------------------------------------------------
// 增量同步
// ---------------------------------------------------------------------------

/**
 * 从 Supabase 增量拉取指定类型的数据。
 */
async function incrementalPull<T extends { updated_at?: string; created_at?: string }>(
  tableName: string,
  incrementField: string,
  lastSyncAt: number | null,
  userId?: string,
  additionalFilters?: Record<string, unknown>,
): Promise<T[]> {
  let query = supabase.from(tableName).select('*');

  // 增量过滤
  if (lastSyncAt) {
    const lastSyncISO = new Date(lastSyncAt).toISOString();
    query = query.gt(incrementField, lastSyncISO);
  }

  // 用户过滤
  if (userId) {
    // 尝试 customer_id 或 technician_id
    const rule = getSyncRule(tableName);
    if (tableName === 'jobs') {
      query = query.or(`customer_id.eq.${userId},technician_id.eq.${userId}`);
    } else if (tableName === 'messages') {
      // 消息按 job_id 增量，由调用方传入 jobId
    } else if (tableName === 'profiles') {
      query = query.eq('id', userId);
    }
  }

  // 额外过滤条件
  if (additionalFilters) {
    for (const [key, value] of Object.entries(additionalFilters)) {
      query = query.eq(key, value);
    }
  }

  // 排序 + 分页
  query = query.order(incrementField, { ascending: true }).limit(500);

  const { data, error } = await query;

  if (error) {
    console.warn(`[sync] incrementalPull failed for ${tableName}:`, error.message);
    return [];
  }

  return (data || []) as T[];
}

/**
 * 全量拉取指定类型数据。
 */
async function fullPull<T>(
  tableName: string,
  userId?: string,
  additionalFilters?: Record<string, unknown>,
): Promise<T[]> {
  let query = supabase.from(tableName).select('*');

  if (userId) {
    if (tableName === 'jobs') {
      query = query.or(`customer_id.eq.${userId},technician_id.eq.${userId}`);
    } else if (tableName === 'profiles') {
      query = query.eq('id', userId);
    }
  }

  if (additionalFilters) {
    for (const [key, value] of Object.entries(additionalFilters)) {
      query = query.eq(key, value);
    }
  }

  query = query.limit(1000);

  const { data, error } = await query;

  if (error) {
    console.warn(`[sync] fullPull failed for ${tableName}:`, error.message);
    return [];
  }

  return (data || []) as T[];
}

// ---------------------------------------------------------------------------
// 同步执行器（用于队列）
// ---------------------------------------------------------------------------

async function syncQueueExecutor(
  item: SyncQueueItem,
): Promise<{ success: boolean; error?: string }> {
  const rule = getSyncRule(item.key);
  if (!rule) {
    return { success: false, error: `Unknown sync key: ${item.key}` };
  }

  try {
    const table = supabase.from(rule.tableName);

    switch (item.operation) {
      case 'create': {
        const { error } = await table.insert(item.payload as Record<string, unknown>);
        if (error) throw error;
        break;
      }
      case 'update': {
        const payload = item.payload as { id: string;[key: string]: unknown };
        const { id, ...updates } = payload;
        const { error } = await table.update(updates).eq('id', id);
        if (error) throw error;
        break;
      }
      case 'delete': {
        const payload = item.payload as { id: string };
        const { error } = await table.delete().eq('id', payload.id);
        if (error) throw error;
        break;
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 全量同步
// ---------------------------------------------------------------------------

/**
 * 执行一次完整的同步周期：
 * 1. 拉取远程增量数据
 * 2. 推送本地离线队列
 * 3. 更新缓存
 */
export async function performFullSync(): Promise<SyncResult[]> {
  if (!isOnline()) {
    updateSyncState({ status: 'offline' });
    return [{
      key: 'all',
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: ['设备离线'],
      duration: 0,
    }];
  }

  updateSyncState({ status: 'syncing', error: null, progress: 0 });

  const results: SyncResult[] = [];
  const keys = getSyncKeysByPriority();
  const totalKeys = keys.length;

  // 阶段 1: 增量拉取远程数据
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const rule = getSyncRule(key);
    if (!rule) continue;

    updateSyncState({ currentSyncKey: key, progress: (i / totalKeys) * 0.5 });

    const startTime = Date.now();
    try {
      const lastSyncAt = syncState.lastSyncAt;
      const data = await incrementalPull(
        rule.tableName,
        rule.incrementField,
        // 对于增量 key，使用 lastSyncAt；对于全量 key，传 null
        rule.incrementField ? lastSyncAt : null,
      );

      if (data.length > 0) {
        await cacheWrite(key, data);
      }

      results.push({
        key,
        success: true,
        itemsProcessed: data.length,
        itemsFailed: 0,
        errors: [],
        duration: Date.now() - startTime,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        key,
        success: false,
        itemsProcessed: 0,
        itemsFailed: 0,
        errors: [message],
        duration: Date.now() - startTime,
      });
    }
  }

  // 阶段 2: 推送本地离线队列
  updateSyncState({ currentSyncKey: 'queue', progress: 0.75 });

  try {
    const queueResult = await flushSyncQueue(syncQueueExecutor);
    results.push(queueResult);

    // 更新队列大小
    const stats = await getSyncQueueStats();
    updateSyncState({ queueSize: stats.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      key: 'queue',
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: [message],
      duration: 0,
    });
  }

  // 更新最后同步时间
  const now = Date.now();
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));

  const allSuccess = results.every((r) => r.success);
  updateSyncState({
    status: allSuccess ? 'completed' : 'failed',
    lastSyncAt: now,
    currentSyncKey: null,
    progress: 1,
  });

  return results;
}

/**
 * 同步指定 key 的数据。
 */
export async function syncByKey(
  key: string,
  userId?: string,
  additionalFilters?: Record<string, unknown>,
): Promise<SyncResult> {
  const rule = getSyncRule(key);
  if (!rule) {
    return {
      key,
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: [`Unknown sync key: ${key}`],
      duration: 0,
    };
  }

  if (!isOnline()) {
    return {
      key,
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: ['设备离线'],
      duration: 0,
    };
  }

  const startTime = Date.now();
  try {
    updateSyncState({ status: 'syncing', currentSyncKey: key });

    const data = await incrementalPull(
      rule.tableName,
      rule.incrementField,
      syncState.lastSyncAt,
      userId,
      additionalFilters,
    );

    if (data.length > 0) {
      await cacheWrite(key, data);
    }

    updateSyncState({ status: 'completed', currentSyncKey: null });

    return {
      key,
      success: true,
      itemsProcessed: data.length,
      itemsFailed: 0,
      errors: [],
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateSyncState({ status: 'failed', currentSyncKey: null, error: message });

    return {
      key,
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: [message],
      duration: Date.now() - startTime,
    };
  }
}

// ---------------------------------------------------------------------------
// 订阅 & 状态 API
// ---------------------------------------------------------------------------

/**
 * 获取当前同步状态。
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * 订阅同步状态变化。
 * 返回取消订阅函数。
 */
export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);

  // 立即推送当前状态
  try {
    listener({ ...syncState });
  } catch {
    // 忽略
  }

  return () => {
    listeners.delete(listener);
  };
}

/**
 * 手动触发同步。
 */
export async function triggerManualSync(): Promise<SyncResult[]> {
  return performFullSync();
}

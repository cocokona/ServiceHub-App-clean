/**
 * syncQueue.service.ts — 离线操作队列管理
 *
 * 负责：
 * - 离线写入队列化（pending_sync 队列）
 * - 网络恢复后批量同步
 * - 指数退避重试（最多 3 次）
 * - 按优先级排序执行
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SyncQueueItem,
  SyncResult,
  SYNC_QUEUE_KEY,
  DEFAULT_RETRY_CONFIG,
  SyncPriority,
} from './syncConfig';

// ---------------------------------------------------------------------------
// 队列持久化
// ---------------------------------------------------------------------------

/**
 * 加载持久化同步队列。
 */
export async function loadSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (raw) {
      const items: SyncQueueItem[] = JSON.parse(raw);
      // 清理已过期的旧条目（超过 24 小时未成功同步）
      const now = Date.now();
      return items.filter((item) => now - item.createdAt < 24 * 60 * 60 * 1000);
    }
  } catch {
    // 队列数据损坏，重置
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
  }
  return [];
}

/**
 * 保存同步队列到本地。
 */
async function saveSyncQueue(items: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// 队列操作
// ---------------------------------------------------------------------------

let idCounter = 0;

/**
 * 生成唯一队列项 ID。
 */
function generateId(): string {
  idCounter += 1;
  return `sync_${Date.now()}_${idCounter}`;
}

/**
 * 向队列添加一个操作。
 */
export async function enqueueSyncOperation(
  key: string,
  operation: SyncQueueItem['operation'],
  payload: unknown,
  priority: SyncPriority = 'normal',
): Promise<string> {
  const items = await loadSyncQueue();

  const newItem: SyncQueueItem = {
    id: generateId(),
    key,
    operation,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };

  items.push(newItem);

  // 按优先级排序：high > normal > low
  const priorityOrder: Record<SyncPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };

  items.sort(
    (a, b) =>
      priorityOrder[priority] - priorityOrder[priority] ||
      a.createdAt - b.createdAt,
  );

  await saveSyncQueue(items);
  return newItem.id;
}

/**
 * 从队列中移除已完成的操作。
 */
export async function dequeueSyncOperation(itemId: string): Promise<void> {
  const items = await loadSyncQueue();
  const filtered = items.filter((item) => item.id !== itemId);
  await saveSyncQueue(filtered);
}

/**
 * 获取队列大小。
 */
export async function getSyncQueueSize(): Promise<number> {
  const items = await loadSyncQueue();
  return items.length;
}

/**
 * 检查队列是否为空。
 */
export async function isSyncQueueEmpty(): Promise<boolean> {
  const size = await getSyncQueueSize();
  return size === 0;
}

/**
 * 清空同步队列。
 */
export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

// ---------------------------------------------------------------------------
// 重试逻辑
// ---------------------------------------------------------------------------

/**
 * 获取指定重试次数的延迟（指数退避）。
 */
function getRetryDelay(retryCount: number): number {
  const config = DEFAULT_RETRY_CONFIG;
  if (retryCount >= config.delays.length) {
    return -1; // 放弃重试
  }
  return config.delays[retryCount];
}

/**
 * 获取指定重试次数的超时时间。
 */
function getRetryTimeout(retryCount: number): number {
  const config = DEFAULT_RETRY_CONFIG;
  const index = Math.min(retryCount, config.timeouts.length - 1);
  return config.timeouts[index];
}

/**
 * 为队列项增加重试计数。
 */
async function incrementRetry(itemId: string): Promise<number> {
  const items = await loadSyncQueue();
  const item = items.find((i) => i.id === itemId);
  if (!item) return -1;

  item.retries += 1;

  if (item.retries > DEFAULT_RETRY_CONFIG.maxRetries) {
    // 超过最大重试次数，移除队列项（用户需手动重试）
    await dequeueSyncOperation(itemId);
    return -1;
  }

  await saveSyncQueue(items);
  return item.retries;
}

// ---------------------------------------------------------------------------
// 队列同步执行器
// ---------------------------------------------------------------------------

type SyncExecutorFn = (
  item: SyncQueueItem,
) => Promise<{ success: boolean; error?: string }>;

/**
 * 批量执行同步队列中的所有操作。
 *
 * @param executor - 单个操作的执行器函数
 * @returns 同步结果
 */
export async function flushSyncQueue(
  executor: SyncExecutorFn,
): Promise<SyncResult> {
  const items = await loadSyncQueue();

  if (items.length === 0) {
    return {
      key: 'all',
      success: true,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: [],
      duration: 0,
    };
  }

  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const result = await executor(item);

      if (result.success) {
        await dequeueSyncOperation(item.id);
        processed++;
      } else {
        // 重试
        const delay = getRetryDelay(item.retries);
        if (delay >= 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          // 递增重试计数，留待下次 flush 再试
          const newRetries = await incrementRetry(item.id);
          if (newRetries < 0) {
            // 最终失败
            failed++;
            errors.push(
              `[${item.key}] ${item.operation}: ${result.error} (放弃重试)`,
            );
          }
        } else {
          failed++;
          errors.push(`[${item.key}] ${item.operation}: ${result.error}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed++;
      errors.push(`[${item.key}] ${item.operation}: ${message}`);

      // 递增重试
      await incrementRetry(item.id);
    }
  }

  return {
    key: 'all',
    success: failed === 0,
    itemsProcessed: processed,
    itemsFailed: failed,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * 获取队列统计信息。
 */
export async function getSyncQueueStats(): Promise<{
  total: number;
  byKey: Record<string, number>;
  oldestItem: number;
}> {
  const items = await loadSyncQueue();
  const byKey: Record<string, number> = {};

  for (const item of items) {
    byKey[item.key] = (byKey[item.key] || 0) + 1;
  }

  return {
    total: items.length,
    byKey,
    oldestItem: items.length > 0 ? items[0].createdAt : 0,
  };
}

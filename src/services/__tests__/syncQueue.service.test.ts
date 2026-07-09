import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueSyncOperation,
  dequeueSyncOperation,
  getSyncQueueSize,
  loadSyncQueue,
  flushSyncQueue,
} from '../syncQueue.service';

describe('syncQueue.service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueue adds an item and dequeue removes it', async () => {
    const id = await enqueueSyncOperation('jobs', 'update', { id: 'a' });
    expect(await getSyncQueueSize()).toBe(1);
    await dequeueSyncOperation(id);
    expect(await getSyncQueueSize()).toBe(0);
  });

  it('orders the queue by priority (high > normal > low)', async () => {
    await enqueueSyncOperation('jobs', 'update', { id: 'low' }, 'low');
    await enqueueSyncOperation('jobs', 'update', { id: 'high' }, 'high');
    await enqueueSyncOperation('jobs', 'update', { id: 'normal' }, 'normal');

    const items = await loadSyncQueue();
    expect(items.map((i) => (i.payload as any).id)).toEqual(['high', 'normal', 'low']);
  });

  it('flushSyncQueue processes a successful op and removes it from the queue', async () => {
    await enqueueSyncOperation('jobs', 'create', { id: 'x' });
    const executor = vi.fn(async () => ({ success: true }));

    const result = await flushSyncQueue(executor);

    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBe(1);
    expect(await getSyncQueueSize()).toBe(0);
  });

  it('flushSyncQueue retries with exponential backoff and drops the item after maxRetries', async () => {
    vi.useFakeTimers();
    try {
      await enqueueSyncOperation('jobs', 'update', { id: 'j1' });
      const executor = vi.fn(async () => ({ success: false, error: 'boom' }));

      // The item keeps failing; retry delays are [0, 2000, 5000]. Each flush
      // awaits a setTimeout, so we must advance fake timers before awaiting.
      // After 4 failed flushes the retries counter exceeds maxRetries (3) and
      // the item is dequeued permanently.
      let last: any = undefined;
      for (let i = 0; i < 4; i++) {
        const p = flushSyncQueue(executor);
        // eslint-disable-next-line no-await-in-loop
        await vi.advanceTimersByTimeAsync(6000);
        // eslint-disable-next-line no-await-in-loop
        last = await p;
      }

      expect(await getSyncQueueSize()).toBe(0);
      expect(executor.mock.calls.length).toBe(4);
      expect(last.itemsFailed).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  putCacheEntry,
  getCacheEntry,
  removeCacheEntry,
  clearAllCache,
} from '../storage.service';

const cfg = {
  key: 'test',
  ttl: 60000,
  granularity: 'full',
  eviction: 'lru',
  offlineFallback: 'cache',
} as any;

describe('storage.service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a cache entry', async () => {
    await putCacheEntry(cfg, { hello: 'world' });
    const entry = await getCacheEntry(cfg);
    expect(entry).not.toBeNull();
    expect(entry!.data).toEqual({ hello: 'world' });
  });

  it('returns null for a missing key', async () => {
    expect(await getCacheEntry(cfg)).toBeNull();
  });

  it('returns null and removes an expired entry on read', async () => {
    const storageKey = 'sh_cache:test';
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        key: 'test',
        data: { a: 1 },
        cachedAt: Date.now() - 100000,
        ttl: 1000,
      }),
    );

    const entry = await getCacheEntry(cfg);
    expect(entry).toBeNull();
    expect(await AsyncStorage.getItem(storageKey)).toBeNull();
  });

  it('removeCacheEntry deletes the entry', async () => {
    await putCacheEntry(cfg, { a: 1 });
    await removeCacheEntry('test');
    expect(await getCacheEntry(cfg)).toBeNull();
  });

  it('clearAllCache empties the cache store', async () => {
    await putCacheEntry(cfg, { a: 1 });
    await clearAllCache();
    expect(await getCacheEntry(cfg)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  isCacheExpired,
  isCacheStale,
  getCacheConfig,
  registerCacheConfig,
} from '../cacheConfig';

describe('cacheConfig', () => {
  it('isCacheExpired: zero ttl is always expired', () => {
    expect(isCacheExpired({ key: 'k', data: 1, cachedAt: Date.now(), ttl: 0 })).toBe(true);
  });

  it('isCacheExpired: fresh entry is not expired', () => {
    expect(isCacheExpired({ key: 'k', data: 1, cachedAt: Date.now(), ttl: 100000 })).toBe(false);
  });

  it('isCacheExpired: old entry is expired', () => {
    expect(isCacheExpired({ key: 'k', data: 1, cachedAt: Date.now() - 5000, ttl: 1000 })).toBe(true);
  });

  it('isCacheStale: zero ttl is always stale', () => {
    expect(isCacheStale({ key: 'k', data: 1, cachedAt: Date.now(), ttl: 0 })).toBe(true);
  });

  it('isCacheStale: recently cached entry is not stale', () => {
    expect(isCacheStale({ key: 'k', data: 1, cachedAt: Date.now(), ttl: 100000 })).toBe(false);
  });

  it('isCacheStale: past 80% of ttl is stale (soft expiry)', () => {
    // 900ms of a 1000ms ttl => 90% elapsed => should be flagged stale
    expect(isCacheStale({ key: 'k', data: 1, cachedAt: Date.now() - 900, ttl: 1000 })).toBe(true);
  });

  it('getCacheConfig returns the registered config for a known key', () => {
    const c = getCacheConfig('jobs');
    expect(c.key).toBe('jobs');
    expect(c.ttl).toBe(300000);
  });

  it('getCacheConfig falls back to the default config for an unknown key', () => {
    const c = getCacheConfig('does-not-exist');
    expect(c.key).toBe('does-not-exist');
    expect(c.ttl).toBe(600000); // defaultConfig.ttl from JSON
    expect(c.granularity).toBe('full');
  });

  it('registerCacheConfig adds/overrides a runtime config', () => {
    registerCacheConfig({
      key: 'custom',
      ttl: 123,
      granularity: 'full',
      eviction: 'none',
      offlineFallback: 'cache',
    });
    expect(getCacheConfig('custom').ttl).toBe(123);
  });
});

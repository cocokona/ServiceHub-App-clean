/**
 * vitest.setup.ts — global test setup.
 *
 * Provides an in-memory implementation of `@react-native-async-storage/
 * async-storage` so that storage / cache / sync-queue services can be unit
 * tested without a native module or a real device. The same mock instance is
 * shared across all test files; reset it in `beforeEach` via
 * `AsyncStorage.clear()` if you need an empty store per case.
 */

import { vi } from 'vitest';

const store = new Map<string, string>();

export const asyncStorageMock = {
  __store: store,
  getItem: vi.fn(async (key: string) => (store.has(key) ? (store.get(key) as string) : null)),
  setItem: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  multiRemove: vi.fn(async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  }),
  getAllKeys: vi.fn(async () => Array.from(store.keys())),
  clear: vi.fn(async () => {
    store.clear();
  }),
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

import { describe, it, expect } from 'vitest';
import {
  resolveConflict,
  getSyncRule,
  getSyncKeysByPriority,
} from '../syncConfig';

describe('syncConfig', () => {
  it('resolveConflict last_write_wins prefers the newer remote', () => {
    const local = { updated_at: '2024-01-01T00:00:00Z' };
    const remote = { updated_at: '2024-02-01T00:00:00Z' };
    expect(resolveConflict(local, remote, 'last_write_wins')).toBe(remote);
  });

  it('resolveConflict last_write_wins prefers local when it is newer', () => {
    const local = { updated_at: '2024-03-01T00:00:00Z' };
    const remote = { updated_at: '2024-02-01T00:00:00Z' };
    expect(resolveConflict(local, remote, 'last_write_wins')).toBe(local);
  });

  it('resolveConflict merge combines local and remote fields', () => {
    const local = { a: 1 };
    const remote = { b: 2 };
    expect(resolveConflict(local as any, remote as any, 'merge')).toEqual({ a: 1, b: 2 });
  });

  it('resolveConflict optimistic_lock always returns remote', () => {
    const local = { a: 1 };
    const remote = { a: 2 };
    expect(resolveConflict(local as any, remote as any, 'optimistic_lock')).toBe(remote);
  });

  it('resolveConflict falls back to remote for an unknown strategy', () => {
    const local = { a: 1 };
    const remote = { a: 2 };
    // @ts-expect-error exercising the default branch
    expect(resolveConflict(local, remote, 'weird')).toBe(remote);
  });

  it('getSyncRule returns the registered rule for a known key', () => {
    const rule = getSyncRule('jobs');
    expect(rule).not.toBeNull();
    expect(rule?.tableName).toBe('jobs');
    expect(rule?.incrementField).toBe('updated_at');
  });

  it('getSyncRule returns null for an unknown key', () => {
    expect(getSyncRule('nope')).toBeNull();
  });

  it('getSyncKeysByPriority orders high > normal > low', () => {
    const keys = getSyncKeysByPriority();
    const hi = keys.indexOf('jobs'); // priority: high
    const nor = keys.indexOf('profiles'); // priority: normal
    const lo = keys.indexOf('services'); // priority: low
    expect(hi).toBeGreaterThanOrEqual(0);
    expect(nor).toBeGreaterThan(hi);
    expect(lo).toBeGreaterThan(nor);
  });
});

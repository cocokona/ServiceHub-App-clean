/**
 * timer.service.ts — Timestamp-anchored, lifecycle-resilient timer.
 *
 * Core idea: we never trust continuous "active counting". Instead we persist a
 * wall-clock anchor (`Date.now()`) when a run starts/resumes, and derive the
 * elapsed/remaining value as `now - anchorAt` at read time. Because the anchor
 * is a real timestamp, the timer is automatically correct after the screen
 * turns off, the app is backgrounded, or even after the process is killed and
 * later reopened — on the next read we simply recompute from the saved anchor.
 *
 * This is the storage/state layer. It has no React dependency so it can be
 * unit-tested in a plain Node environment (AsyncStorage is mocked in tests).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export type TimerMode = 'stopwatch' | 'countdown';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerSnapshot {
  mode: TimerMode;
  status: TimerStatus;
  /**
   * Stopwatch: elapsed ms accumulated *before* the current running segment.
   * Countdown: remaining ms at the start of the current running segment.
   */
  baseMs: number;
  /** Epoch ms when the current running segment began; null unless running. */
  anchorAt: number | null;
  /** Countdown only: total duration target (ms). 0 for stopwatch. */
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface ComputedTimer {
  elapsedMs: number;
  remainingMs: number;
  /** 0..1 progress (countdown only; 0 for stopwatch). */
  progress: number;
  status: TimerStatus;
  mode: TimerMode;
}

export interface PersistentTimerOptions {
  /** Stable id; used as the persistence key (`timer:<id>`). */
  id: string;
  mode: TimerMode;
  /** Required for `countdown`; total duration in ms. */
  durationMs?: number;
  /** Injectable clock for testing; defaults to Date.now(). */
  now?: () => number;
}

const STORAGE_PREFIX = 'timer:';
const VALID_STATUS: TimerStatus[] = ['idle', 'running', 'paused', 'finished'];

function defaultState(opts: PersistentTimerOptions, nowMs: number): TimerSnapshot {
  const durationMs = opts.mode === 'countdown' ? Math.max(0, opts.durationMs ?? 0) : 0;
  return {
    mode: opts.mode,
    status: 'idle',
    baseMs: opts.mode === 'countdown' ? durationMs : 0,
    anchorAt: null,
    durationMs,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
}

/**
 * Pure derivation: given a snapshot and the current wall-clock time, compute
 * the live elapsed/remaining values. This is the heart of the "resume
 * seamlessly" guarantee — it works regardless of how much real time passed.
 */
function compute(s: TimerSnapshot, nowMs: number): ComputedTimer {
  let live = s.baseMs;
  if (s.status === 'running' && s.anchorAt != null) {
    const delta = nowMs - s.anchorAt;
    live = s.mode === 'stopwatch' ? s.baseMs + delta : s.baseMs - delta;
  }

  if (s.mode === 'countdown') {
    const remaining = Math.max(0, live);
    const elapsed = s.durationMs - remaining;
    const progress = s.durationMs > 0 ? Math.min(1, elapsed / s.durationMs) : 0;
    return { elapsedMs: elapsed, remainingMs: remaining, progress, status: s.status, mode: s.mode };
  }

  const elapsed = Math.max(0, live);
  return { elapsedMs: elapsed, remainingMs: 0, progress: 0, status: s.status, mode: s.mode };
}

export class PersistentTimer {
  private state: TimerSnapshot;
  private readonly storageKey: string;
  private readonly now: () => number;
  private listeners = new Set<(s: TimerSnapshot) => void>();

  constructor(opts: PersistentTimerOptions) {
    if (opts.mode === 'countdown' && !(opts.durationMs && opts.durationMs > 0)) {
      throw new Error('[timer] countdown mode requires durationMs > 0');
    }
    this.now = opts.now ?? Date.now;
    this.storageKey = `${STORAGE_PREFIX}${opts.id}`;
    this.state = defaultState(opts, this.now());
  }

  /** Load any persisted state (or create a fresh idle state). Safe to call once on mount. */
  async init(): Promise<TimerSnapshot> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (raw) {
        this.state = this.normalizeLoaded(raw);
      }
    } catch (err) {
      logger.warn('[timer] failed to load persisted state, starting fresh', {
        id: this.storageKey,
        error: String(err),
      });
      this.state = this.fresh();
    }

    // If a countdown reached zero while we were away (app killed / offline),
    // reflect the completion immediately on the next read.
    if (this.state.status === 'running' && this.state.mode === 'countdown') {
      const c = compute(this.state, this.now());
      if (c.remainingMs <= 0) {
        this.state = this.finish(this.state);
        void this.persist(this.state);
      }
    }

    this.emit();
    return this.state;
  }

  getState(): TimerSnapshot {
    return this.state;
  }

  getComputed(nowMs: number = this.now()): ComputedTimer {
    return compute(this.state, nowMs);
  }

  /** Begin (or resume) counting. No-op if already running. */
  start(): Promise<TimerSnapshot> {
    const now = this.now();
    const s = this.state;
    if (s.status === 'running') return Promise.resolve(s);

    let baseMs = s.baseMs;
    if (s.mode === 'countdown' && (s.status === 'idle' || s.status === 'finished')) {
      // (Re)start from the full duration.
      baseMs = s.durationMs;
    }
    // stopwatch: baseMs already holds accumulated time (0 when idle).

    const next: TimerSnapshot = {
      ...s,
      status: 'running',
      baseMs,
      anchorAt: now,
      updatedAt: now,
    };
    return this.commit(next);
  }

  /** Pause counting; freeze the current value. No-op if not running. */
  pause(): Promise<TimerSnapshot> {
    const now = this.now();
    const s = this.state;
    if (s.status !== 'running') return Promise.resolve(s);

    const delta = now - (s.anchorAt ?? now);
    const baseMs =
      s.mode === 'stopwatch'
        ? s.baseMs + delta
        : Math.max(0, s.baseMs - delta);

    const next: TimerSnapshot = {
      ...s,
      status: 'paused',
      baseMs,
      anchorAt: null,
      updatedAt: now,
    };
    return this.commit(next);
  }

  /** Reset to the initial state (zero for stopwatch, full duration for countdown). */
  reset(): Promise<TimerSnapshot> {
    const now = this.now();
    const s = this.state;
    const baseMs = s.mode === 'countdown' ? s.durationMs : 0;
    const next: TimerSnapshot = {
      ...s,
      status: 'idle',
      baseMs,
      anchorAt: null,
      updatedAt: now,
    };
    return this.commit(next);
  }

  /**
   * Recompute at the current time. For a running countdown that has reached
   * zero, this transitions to `finished`, persists it, and returns the new
   * state. Otherwise it just emits so subscribers refresh the display.
   */
  tick(nowMs: number = this.now()): TimerSnapshot {
    const s = this.state;
    if (s.status === 'running' && s.mode === 'countdown' && s.anchorAt != null) {
      const remaining = Math.max(0, s.baseMs - (nowMs - s.anchorAt));
      if (remaining <= 0) {
        const finished = this.finish(s);
        void this.persist(finished);
        this.state = finished;
        this.emit();
        return finished;
      }
    }
    this.emit();
    return s;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(cb: (s: TimerSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Drop all subscribers (call on unmount). */
  destroy(): void {
    this.listeners.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async commit(next: TimerSnapshot): Promise<TimerSnapshot> {
    this.state = next;
    this.emit();
    await this.persist(next);
    return next;
  }

  private async persist(s: TimerSnapshot): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(s));
    } catch (err) {
      logger.error('[timer] failed to persist state', {
        id: this.storageKey,
        error: String(err),
      });
    }
  }

  private finish(s: TimerSnapshot): TimerSnapshot {
    return {
      ...s,
      status: 'finished',
      baseMs: s.mode === 'countdown' ? 0 : s.baseMs,
      anchorAt: null,
      updatedAt: this.now(),
    };
  }

  private emit(): void {
    for (const l of this.listeners) {
      try {
        l(this.state);
      } catch (e) {
        logger.error('[timer] listener threw', { error: String(e) });
      }
    }
  }

  private fresh(): TimerSnapshot {
    return defaultState(
      { id: this.storageKey, mode: this.state.mode, durationMs: this.state.durationMs },
      this.now(),
    );
  }

  private normalizeLoaded(raw: string): TimerSnapshot {
    let p: Partial<TimerSnapshot>;
    try {
      p = JSON.parse(raw) as Partial<TimerSnapshot>;
    } catch {
      return this.fresh();
    }
    if (!p || typeof p !== 'object') return this.fresh();
    if (p.mode !== 'stopwatch' && p.mode !== 'countdown') return this.fresh();
    if (!VALID_STATUS.includes(p.status as TimerStatus)) return this.fresh();

    const durationMs =
      p.mode === 'countdown' ? Math.max(0, Number(p.durationMs) || 0) : 0;
    const baseMs = Number.isFinite(p.baseMs)
      ? Math.max(0, p.baseMs as number)
      : p.mode === 'countdown'
        ? durationMs
        : 0;
    const anchorAt = p.anchorAt == null ? null : Number(p.anchorAt);

    return {
      mode: p.mode,
      status: p.status as TimerStatus,
      baseMs,
      anchorAt,
      durationMs,
      createdAt: Number(p.createdAt) || this.now(),
      updatedAt: this.now(),
    };
  }
}

/**
 * Format a duration in ms as `mm:ss`, or `hh:mm:ss` when `withHours` is set or
 * the value exceeds one hour.
 */
export function formatDuration(ms: number, withHours = false): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (withHours || h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * usePersistentTimer.ts — React hook for the timestamp-anchored timer.
 *
 * Wraps `PersistentTimer` and keeps the displayed value live while the app is
 * active and running. Crucially:
 *  - The interval is stopped whenever the app is backgrounded (battery friendly).
 *  - On returning to the foreground the timer is recomputed from its saved
 *    wall-clock anchor, so the displayed value is instantly correct even after
 *    the screen was off or the process was killed.
 *  - State is persisted by the service, so a reopened app resumes seamlessly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  PersistentTimer,
  ComputedTimer,
  TimerSnapshot,
  TimerMode,
} from '../services/timer.service';

export interface UsePersistentTimerOptions {
  /** Stable id; must match across mounts to restore the same timer. */
  id: string;
  mode: TimerMode;
  /** Required for `countdown`; total duration in ms. */
  durationMs?: number;
  /** Display refresh cadence while running & active. Default 250ms. */
  intervalMs?: number;
  /** Fired once when a countdown reaches zero. */
  onComplete?: () => void;
}

export interface UsePersistentTimerResult {
  status: TimerSnapshot['status'];
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  isIdle: boolean;
  elapsedMs: number;
  remainingMs: number;
  /** 0..1 (countdown only). */
  progress: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  /** Force a recompute + re-render (e.g. after returning to foreground). */
  refresh: () => void;
}

export function usePersistentTimer(opts: UsePersistentTimerOptions): UsePersistentTimerResult {
  const { id, mode, durationMs, intervalMs = 250, onComplete } = opts;

  // Create the underlying timer once (lazy ref init).
  const timerRef = useRef<PersistentTimer | null>(null);
  if (timerRef.current === null) {
    timerRef.current = new PersistentTimer({ id, mode, durationMs });
  }

  const [state, setState] = useState<TimerSnapshot>(() => timerRef.current!.getState());
  const [computed, setComputed] = useState<ComputedTimer>(() => timerRef.current!.getComputed());
  const [appActive, setAppActive] = useState<boolean>(AppState.currentState === 'active');

  // Keep onComplete in a ref so the subscription/listener stays stable.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Guards against firing onComplete more than once per run.
  const completedRef = useRef(false);

  const sync = useCallback(() => {
    const t = timerRef.current!;
    const nextState = t.getState();
    const nextComputed = t.getComputed();
    setState(nextState);
    setComputed(nextComputed);

    if (nextState.status === 'finished') {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    } else {
      completedRef.current = false;
    }
  }, []);

  // Load persisted state on mount and subscribe to service updates.
  useEffect(() => {
    let active = true;
    const unsub = timerRef.current!.subscribe(() => {
      if (active) sync();
    });
    timerRef.current!.init().then(() => {
      if (active) sync();
    });

    return () => {
      active = false;
      unsub();
    };
  }, [sync]);

  // Recompute when the app returns to the foreground (screen on / reopened).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setAppActive(next === 'active');
      if (next === 'active') {
        timerRef.current!.tick();
      }
    });
    return () => sub.remove();
  }, []);

  // Drive the display only while running AND the app is active. We stop the
  // interval in the background — the timestamp anchor makes it unnecessary and
  // saves battery. The next foreground event refreshes the value.
  useEffect(() => {
    if (state.status !== 'running' || !appActive) return;
    const handle = setInterval(() => {
      timerRef.current!.tick();
    }, intervalMs);
    return () => clearInterval(handle);
  }, [state.status, appActive, intervalMs]);

  const start = useCallback(() => {
    void timerRef.current!.start();
  }, []);

  const pause = useCallback(() => {
    void timerRef.current!.pause();
  }, []);

  const reset = useCallback(() => {
    void timerRef.current!.reset();
  }, []);

  const refresh = useCallback(() => {
    timerRef.current!.tick();
  }, []);

  return {
    status: state.status,
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
    isFinished: state.status === 'finished',
    isIdle: state.status === 'idle',
    elapsedMs: computed.elapsedMs,
    remainingMs: computed.remainingMs,
    progress: computed.progress,
    start,
    pause,
    reset,
    refresh,
  };
}

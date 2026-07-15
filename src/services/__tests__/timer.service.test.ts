import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistentTimer, formatDuration } from '../timer.service';

describe('PersistentTimer (stopwatch)', () => {
  let now = 1_000_000;
  const clock = () => now;

  beforeEach(async () => {
    await AsyncStorage.clear();
    now = 1_000_000;
  });

  it('accumulates elapsed time from a wall-clock anchor', async () => {
    const t = new PersistentTimer({ id: 'sw1', mode: 'stopwatch', now: clock });
    await t.init();
    await t.start();
    now += 5000;
    expect(t.getComputed().elapsedMs).toBe(5000);

    await t.pause();
    // Paused: advancing real time must NOT change elapsed.
    now += 99999;
    expect(t.getComputed().elapsedMs).toBe(5000);

    await t.start(); // resume
    now += 2000;
    expect(t.getComputed().elapsedMs).toBe(7000);

    await t.reset();
    expect(t.getComputed().elapsedMs).toBe(0);
  });

  it('persists across reload and continues correctly (app kill + reopen)', async () => {
    const t1 = new PersistentTimer({ id: 'sw2', mode: 'stopwatch', now: clock });
    await t1.init();
    await t1.start();
    now += 3000; // ran for 3s, then app is killed

    // New process, same id.
    const t2 = new PersistentTimer({ id: 'sw2', mode: 'stopwatch', now: clock });
    await t2.init();
    expect(t2.getState().status).toBe('running');
    expect(t2.getComputed().elapsedMs).toBe(3000);

    now += 4000; // 4 more seconds pass while "away"
    expect(t2.getComputed().elapsedMs).toBe(7000);
  });
});

describe('PersistentTimer (countdown)', () => {
  let now = 2_000_000;
  const clock = () => now;

  beforeEach(async () => {
    await AsyncStorage.clear();
    now = 2_000_000;
  });

  it('counts down, has no drift while paused, and finishes', async () => {
    const t = new PersistentTimer({
      id: 'cd1',
      mode: 'countdown',
      durationMs: 10000,
      now: clock,
    });
    await t.init();
    await t.start();
    now += 3000;
    expect(t.getComputed().remainingMs).toBe(7000);

    await t.pause();
    now += 50000; // time passes while paused — must not affect remaining
    expect(t.getComputed().remainingMs).toBe(7000);

    await t.start();
    now += 2000;
    expect(t.getComputed().remainingMs).toBe(5000);

    await t.pause();
    await t.start();
    now += 6000; // 5000 + 6000 => would go negative
    t.tick(); // the running interval calls tick(); it flips to finished
    expect(t.getState().status).toBe('finished');
    expect(t.getComputed().remainingMs).toBe(0);
  });

  it('auto-finishes on init if the end time passed while the app was closed', async () => {
    const t1 = new PersistentTimer({
      id: 'cd2',
      mode: 'countdown',
      durationMs: 10000,
      now: clock,
    });
    await t1.init();
    await t1.start(); // anchorAt = now
    now += 30000; // 30s later, well past the 10s duration

    const t2 = new PersistentTimer({
      id: 'cd2',
      mode: 'countdown',
      durationMs: 10000,
      now: clock,
    });
    await t2.init();
    expect(t2.getState().status).toBe('finished');
    expect(t2.getComputed().remainingMs).toBe(0);
  });

  it('reset restores the full duration', async () => {
    const t = new PersistentTimer({
      id: 'cd3',
      mode: 'countdown',
      durationMs: 5000,
      now: clock,
    });
    await t.init();
    await t.start();
    now += 2000;
    await t.pause();
    await t.reset();
    expect(t.getComputed().remainingMs).toBe(5000);
    expect(t.getState().status).toBe('idle');
  });
});

describe('PersistentTimer persistence robustness', () => {
  let now = 5_000_000;
  const clock = () => now;

  beforeEach(async () => {
    await AsyncStorage.clear();
    now = 5_000_000;
  });

  it('falls back to a fresh idle state on corrupted storage', async () => {
    await AsyncStorage.setItem('timer:bad', '{not valid json');
    const t = new PersistentTimer({ id: 'bad', mode: 'stopwatch', now: clock });
    await t.init();
    expect(t.getState().status).toBe('idle');
    expect(t.getComputed().elapsedMs).toBe(0);
  });

  it('rejects countdown without durationMs', () => {
    expect(
      () => new PersistentTimer({ id: 'x', mode: 'countdown', now: clock }),
    ).toThrow();
  });
});

describe('formatDuration', () => {
  it('formats mm:ss and hh:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65000)).toBe('01:05');
    // exceeds one hour → automatically renders hh:mm:ss even without the flag
    expect(formatDuration(3661000, true)).toBe('01:01:01');
    expect(formatDuration(3661000)).toBe('01:01:01');
  });
});

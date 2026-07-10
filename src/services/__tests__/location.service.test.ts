import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoist = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
  Location: {
    LocationAccuracy: { Balanced: 'balanced' },
    requestForegroundPermissionsAsync: vi.fn(),
    getCurrentPositionAsync: vi.fn(),
    watchPositionAsync: vi.fn(),
  },
  logger: { info: vi.fn(), warn: vi.fn() },
  // logAndThrow re-throws an Error carrying the original .message,
  // mirroring the real implementation in src/services/errors.ts.
  logAndThrow: vi.fn((_op: string, err: unknown) => {
    const msg =
      err && typeof err === 'object'
        ? (err as any).message
        : typeof err === 'string'
          ? err
          : 'Database operation failed';
    throw new Error(msg || 'Database operation failed');
  }),
}));

vi.mock('../../lib/supabase', () => ({ supabase: hoist.supabase }));
vi.mock('expo-location', () => ({
  ...hoist.Location,
  LocationAccuracy: hoist.Location.LocationAccuracy,
}));
vi.mock('../../services/logger', () => ({ logger: hoist.logger }));
vi.mock('../../services/errors', () => ({ logAndThrow: hoist.logAndThrow }));

import {
  startLocationSharing,
  stopLocationSharing,
  getLastKnownLocation,
  subscribeToTechnicianLocation,
  computeEta,
} from '../location.service';

/** Chainable Supabase query builder that resolves to { data, error }. */
function makeBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'or', 'single', 'maybeSingle'].forEach(
    (m) => {
      builder[m] = vi.fn(() => builder);
    }
  );
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('location.service', () => {
  // Captures the postgres_changes INSERT handler registered by
  // subscribeToTechnicianLocation so tests can fire synthetic payloads.
  let lastChannelCb: ((payload: any) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastChannelCb = null;
    hoist.supabase.from.mockReset();
    hoist.supabase.channel.mockReset();
    hoist.supabase.removeChannel.mockReset();

    // channel().on(...).subscribe() chain; .on captures the INSERT handler.
    const fakeChannel: any = {
      on(_evt: string, _cfg: any, cb: any) {
        lastChannelCb = cb;
        return fakeChannel;
      },
      subscribe() {
        return undefined;
      },
    };
    hoist.supabase.channel.mockImplementation(() => fakeChannel);
    // Default: from() returns a chainable builder so insert/select chains work.
    hoist.supabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
  });

  describe('computeEta (pure)', () => {
    it('returns 0 km / 0 min for identical points', () => {
      const r = computeEta(37.7749, -122.4194, 37.7749, -122.4194);
      expect(r.distanceKm).toBe(0);
      expect(r.etaMinutes).toBe(0);
    });

    it('computes a sane distance + ETA for a ~10km separation', () => {
      // ~10km apart in latitude; at 25 km/h that is about 24 min.
      const r = computeEta(37.7749, -122.4194, 37.8656, -122.4194);
      expect(r.distanceKm).toBeGreaterThan(9);
      expect(r.distanceKm).toBeLessThan(11);
      expect(r.etaMinutes).toBeGreaterThan(20);
      expect(r.etaMinutes).toBeLessThan(28);
    });
  });

  describe('subscribeToTechnicianLocation', () => {
    it('registers a postgres_changes INSERT handler and maps the row', () => {
      const cb = vi.fn();
      const unsub = subscribeToTechnicianLocation('job-1', cb);
      expect(hoist.supabase.channel).toHaveBeenCalledWith('tech_loc:job_id=eq.job-1');

      // Fire a synthetic Realtime INSERT (raw snake_case payload).
      expect(lastChannelCb).not.toBeNull();
      lastChannelCb!({
        new: {
          id: 'loc-1',
          job_id: 'job-1',
          technician_id: 'tech-1',
          latitude: 12.34,
          longitude: 56.78,
          heading: 90,
          recorded_at: '2026-07-10T10:00:00Z',
        },
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith({
        id: 'loc-1',
        jobId: 'job-1',
        technicianId: 'tech-1',
        latitude: 12.34,
        longitude: 56.78,
        heading: 90,
        recordedAt: '2026-07-10T10:00:00Z',
      });
      expect(typeof unsub).toBe('function');
    });

    it('returns an unsubscribe that calls removeChannel', () => {
      const unsub = subscribeToTechnicianLocation('job-2', vi.fn());
      unsub();
      expect(hoist.supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLastKnownLocation', () => {
    it('maps the newest row to TechnicianLocation', async () => {
      hoist.supabase.from.mockReturnValue(
        makeBuilder({
          data: {
            id: 'loc-9',
            job_id: 'job-9',
            technician_id: 'tech-9',
            latitude: 1.1,
            longitude: 2.2,
            heading: null,
            recorded_at: '2026-07-10T09:00:00Z',
          },
          error: null,
        })
      );
      const loc = await getLastKnownLocation('job-9');
      expect(loc?.jobId).toBe('job-9');
      expect(loc?.latitude).toBe(1.1);
      expect(loc?.heading).toBeNull();
    });

    it('returns null when no row exists', async () => {
      hoist.supabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
      const loc = await getLastKnownLocation('job-x');
      expect(loc).toBeNull();
    });

    it('re-throws the DB error via logAndThrow', async () => {
      hoist.supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
      await expect(getLastKnownLocation('job-x')).rejects.toThrow('boom');
    });
  });

  describe('startLocationSharing / stopLocationSharing', () => {
    it('requests permission, seeds an insert, and starts the watch', async () => {
      hoist.Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      hoist.Location.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: 3.3, longitude: 4.4, heading: 10 },
      });
      const fakeSub = { remove: vi.fn() };
      hoist.Location.watchPositionAsync.mockResolvedValue(fakeSub);

      const stop = await startLocationSharing('job-s', 'tech-s');
      expect(hoist.Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(hoist.supabase.from).toHaveBeenCalledWith('technician_locations');

      // The seed insert carries the technician + coords.
      const builder = hoist.supabase.from.mock.results[0].value;
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          job_id: 'job-s',
          technician_id: 'tech-s',
          latitude: 3.3,
          longitude: 4.4,
        })
      );
      expect(hoist.Location.watchPositionAsync).toHaveBeenCalled();
      expect(typeof stop).toBe('function');

      // Stopping tears down the watch.
      stop();
      expect(fakeSub.remove).toHaveBeenCalledTimes(1);
    });

    it('throws through logAndThrow when permission is denied', async () => {
      hoist.Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      await expect(startLocationSharing('job-d', 'tech-d')).rejects.toThrow('Location permission denied');
    });

    it('stopLocationSharing is idempotent (no throw when nothing is active)', () => {
      expect(() => stopLocationSharing()).not.toThrow();
    });
  });
});

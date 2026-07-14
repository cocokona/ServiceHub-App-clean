import { describe, it, expect } from 'vitest';
import {
  AUTO_CANCEL_TIMEOUT_MINUTES,
  isSameDayOrder,
  getAutoCancelDeadline,
  isAutoCancelEligible,
  getAutoCancelRemainingMs,
  toLocalDateString,
  getDeviceTimeZone,
} from '../autoCancel';

// A non-UTC zone is the whole point of this feature: the auto-cancel must
// follow the clock the customer sees on their phone, not UTC.
const SHANGHAI = 'Asia/Shanghai';

describe('autoCancel helpers', () => {
  describe('toLocalDateString', () => {
    it('shifts a UTC instant into the target timezone date', () => {
      // 02:00 Shanghai on the 15th == 18:00 UTC on the 14th.
      expect(toLocalDateString('2026-07-14T18:00:00Z', SHANGHAI)).toBe(
        '2026-07-15'
      );
      // 23:55 Shanghai on the 15th == 15:55 UTC the same day.
      expect(toLocalDateString('2026-07-15T15:55:00Z', SHANGHAI)).toBe(
        '2026-07-15'
      );
    });

    it('returns empty string for invalid input', () => {
      expect(toLocalDateString('not-a-date', SHANGHAI)).toBe('');
    });
  });

  describe('isSameDayOrder — UTC path (legacy / device in UTC)', () => {
    it('treats an order scheduled on its creation date as same-day', () => {
      expect(
        isSameDayOrder(
          {
            scheduledDate: '2026-07-14',
            createdAt: '2026-07-14T10:00:00.000Z',
          },
          'UTC'
        )
      ).toBe(true);
    });

    it('excludes future-dated orders (created today, scheduled tomorrow)', () => {
      expect(
        isSameDayOrder(
          {
            scheduledDate: '2026-07-15',
            createdAt: '2026-07-14T10:00:00.000Z',
          },
          'UTC'
        )
      ).toBe(false);
    });

    it('handles the near-midnight edge case: created 23:55 for "today"', () => {
      expect(
        isSameDayOrder(
          {
            scheduledDate: '2026-07-14',
            createdAt: '2026-07-14T23:55:00.000Z',
          },
          'UTC'
        )
      ).toBe(true);
    });
  });

  describe('isSameDayOrder — device timezone (Asia/Shanghai)', () => {
    it('treats an early-morning Shanghai booking as same-day (UTC would be wrong)', () => {
      // Booked 02:00 Shanghai on the 15th == 18:00 UTC on the 14th.
      const order = {
        scheduledDate: '2026-07-15',
        createdAt: '2026-07-14T18:00:00Z',
        localTz: SHANGHAI,
      };
      expect(isSameDayOrder(order)).toBe(true);
      // The old UTC-only logic would have excluded this — proof of the bug.
      expect(toLocalDateString('2026-07-14T18:00:00Z', 'UTC')).toBe(
        '2026-07-14'
      );
    });

    it('near-midnight Shanghai booking stays same-day after midnight', () => {
      const order = {
        scheduledDate: '2026-07-15',
        createdAt: '2026-07-15T15:55:00Z', // 23:55 Shanghai
        localTz: SHANGHAI,
      };
      expect(isSameDayOrder(order)).toBe(true);
    });

    it('excludes a future-dated order even in a non-UTC zone', () => {
      const order = {
        scheduledDate: '2026-07-20',
        createdAt: '2026-07-15T02:00:00Z', // 10:00 Shanghai
        localTz: SHANGHAI,
      };
      expect(isSameDayOrder(order)).toBe(false);
    });

    it('honours an explicit deviceTz argument when localTz is absent', () => {
      const order = {
        scheduledDate: '2026-07-15',
        createdAt: '2026-07-14T18:00:00Z',
      };
      expect(isSameDayOrder(order, SHANGHAI)).toBe(true);
    });

    it('returns false when required fields are missing or invalid', () => {
      expect(isSameDayOrder({ scheduledDate: '2026-07-14' }, SHANGHAI)).toBe(
        false
      );
      expect(
        isSameDayOrder({ createdAt: '2026-07-14T10:00:00.000Z' }, SHANGHAI)
      ).toBe(false);
      expect(
        isSameDayOrder(
          { scheduledDate: '2026-07-14', createdAt: 'not-a-date' },
          SHANGHAI
        )
      ).toBe(false);
    });
  });

  describe('getAutoCancelDeadline', () => {
    it('is created_at + 30 minutes for a same-day order', () => {
      const deadline = getAutoCancelDeadline(
        {
          scheduledDate: '2026-07-14',
          createdAt: '2026-07-14T10:00:00.000Z',
          localTz: 'UTC',
        },
        'UTC'
      );
      expect(deadline).not.toBeNull();
      // 10:00 + 30min = 10:30 UTC
      expect(deadline!.toISOString()).toBe('2026-07-14T10:30:00.000Z');
    });

    it('is null for future-dated orders (no auto-cancel applies)', () => {
      expect(
        getAutoCancelDeadline(
          {
            scheduledDate: '2026-07-15',
            createdAt: '2026-07-14T10:00:00.000Z',
            localTz: 'UTC',
          },
          'UTC'
        )
      ).toBeNull();
    });

    it('keeps the near-midnight deadline after midnight (00:25 next day UTC)', () => {
      // Created 2026-07-14 23:55 UTC, deadline 2026-07-15 00:25 UTC.
      const deadline = getAutoCancelDeadline(
        {
          scheduledDate: '2026-07-14',
          createdAt: '2026-07-14T23:55:00.000Z',
          localTz: 'UTC',
        },
        'UTC'
      );
      expect(deadline!.toISOString()).toBe('2026-07-15T00:25:00.000Z');
    });
  });

  describe('isAutoCancelEligible / getAutoCancelRemainingMs', () => {
    it('is eligible for a same-day order and not eligible for a future one', () => {
      expect(
        isAutoCancelEligible(
          {
            scheduledDate: '2026-07-14',
            createdAt: '2026-07-14T10:00:00.000Z',
            localTz: 'UTC',
          },
          'UTC'
        )
      ).toBe(true);
      expect(
        isAutoCancelEligible(
          {
            scheduledDate: '2026-07-20',
            createdAt: '2026-07-14T10:00:00.000Z',
            localTz: 'UTC',
          },
          'UTC'
        )
      ).toBe(false);
    });

    it('remaining ms counts down to the deadline and goes negative after it', () => {
      const order = {
        scheduledDate: '2026-07-14',
        createdAt: '2026-07-14T10:00:00.000Z',
        localTz: 'UTC',
      };
      // At creation (10:00), 30 minutes remain.
      expect(
        getAutoCancelRemainingMs(order, new Date('2026-07-14T10:00:00.000Z'), 'UTC')
      ).toBe(AUTO_CANCEL_TIMEOUT_MINUTES * 60_000);

      // At 10:15, 15 minutes remain.
      expect(
        getAutoCancelRemainingMs(order, new Date('2026-07-14T10:15:00.000Z'), 'UTC')
      ).toBe(15 * 60_000);

      // At 10:31 (past deadline), remaining is negative.
      expect(
        getAutoCancelRemainingMs(order, new Date('2026-07-14T10:31:00.000Z'), 'UTC')
      ).toBeLessThan(0);
    });

    it('near-midnight Shanghai order: still eligible after midnight, cancelled past 30m', () => {
      const order = {
        scheduledDate: '2026-07-15',
        createdAt: '2026-07-15T15:55:00Z', // 23:55 Shanghai
        localTz: SHANGHAI,
      };
      // 00:20 Shanghai next day -> still within 30 min window (positive).
      expect(
        getAutoCancelRemainingMs(order, new Date('2026-07-15T16:20:00Z'), SHANGHAI)
      ).toBeGreaterThan(0);
      // 00:30 Shanghai next day -> past 30 min window (negative) -> server cancels.
      expect(
        getAutoCancelRemainingMs(order, new Date('2026-07-15T16:30:00Z'), SHANGHAI)
      ).toBeLessThan(0);
    });

    it('returns null remaining for future-dated orders (not subject to SLA)', () => {
      expect(
        getAutoCancelRemainingMs(
          {
            scheduledDate: '2026-07-20',
            createdAt: '2026-07-14T10:00:00.000Z',
            localTz: 'UTC',
          },
          new Date('2026-07-14T10:00:00.000Z'),
          'UTC'
        )
      ).toBeNull();
    });
  });
});

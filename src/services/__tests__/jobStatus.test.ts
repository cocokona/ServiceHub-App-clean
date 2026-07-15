import { describe, it, expect } from 'vitest';
import {
  isJobCompleted,
  isJobRejected,
  isOrderTerminal,
  shouldRevealEarnings,
  computeTechnicianEarnings,
  COMPLETED_STATUSES,
  JOB_STATUS,
} from '../jobStatus';
import type { Job } from '../../types';

/** Build a minimal Job with just the fields the earnings rule touches. */
function makeJob(status: Job['status'], totalPrice: number): Job {
  return {
    id: 'job-1',
    serviceType: 'Cleaning',
    serviceCategory: 'cleaning',
    customerName: 'Jane',
    customerPhone: '+1 415 555 0100',
    customerAvatar: '',
    address: '1 Main St',
    apartment: '',
    city: 'San Francisco',
    zipCode: '94105',
    date: '2026-07-14',
    timeSlot: 'morning',
    rooms: '2',
    duration: 2,
    focusAreas: [],
    notes: '',
    status,
    baseRate: 0,
    tax: 0,
    travelFee: 0,
    addOnsPrice: 0,
    totalPrice,
    elapsedTime: 0,
    checklist: [],
    technicianId: 'tech-1',
  };
}

describe('isJobCompleted', () => {
  it('treats "completed" as finished', () => {
    expect(isJobCompleted('completed')).toBe(true);
  });

  it('treats "reported" (post-completion) as finished', () => {
    expect(isJobCompleted('reported')).toBe(true);
  });

  it.each([
    'pending',
    'confirmed',
    'on_the_way',
    'arrived',
    'in_progress',
    'cancelled',
  ] as const)('treats "%s" as NOT finished', (status) => {
    expect(isJobCompleted(status)).toBe(false);
  });

  it('fails closed on missing/unknown status', () => {
    expect(isJobCompleted(undefined)).toBe(false);
    expect(isJobCompleted(null)).toBe(false);
    expect(isJobCompleted('some_unknown_value' as Job['status'])).toBe(false);
  });
});

describe('shouldRevealEarnings — the core conditional rule', () => {
  it('reveals earnings only after completion', () => {
    expect(shouldRevealEarnings(makeJob('completed', 200))).toBe(true);
  });

  it('reveals earnings for a reported (completed) job', () => {
    expect(shouldRevealEarnings(makeJob('reported', 200))).toBe(true);
  });

  it.each([
    'pending',
    'confirmed',
    'on_the_way',
    'arrived',
    'in_progress',
    'cancelled',
  ] as const)('hides earnings for "%s" status', (status) => {
    expect(shouldRevealEarnings(makeJob(status, 200))).toBe(false);
  });

  it('hides earnings when the job is undefined', () => {
    expect(shouldRevealEarnings(undefined)).toBe(false);
    expect(shouldRevealEarnings(null)).toBe(false);
  });

  it('hides earnings when the price is not a finite number', () => {
    expect(shouldRevealEarnings(makeJob('completed', NaN))).toBe(false);
  });
});

describe('computeTechnicianEarnings', () => {
  it('applies the technician share percentage', () => {
    // 200 * 70% = 140
    expect(computeTechnicianEarnings(200, 70)).toBe(140);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(computeTechnicianEarnings(NaN, 70)).toBe(0);
    expect(computeTechnicianEarnings(200, NaN)).toBe(0);
  });
});

describe('status vocabulary consistency', () => {
  it('lists completed/reported as the only finished statuses', () => {
    expect(COMPLETED_STATUSES).toContain(JOB_STATUS.COMPLETED);
    expect(COMPLETED_STATUSES).toContain(JOB_STATUS.REPORTED);
    expect(COMPLETED_STATUSES).not.toContain(JOB_STATUS.CANCELLED);
    expect(COMPLETED_STATUSES).not.toContain(JOB_STATUS.IN_PROGRESS);
  });
});

describe('isJobRejected', () => {
  it('is true only for the rejected status', () => {
    expect(isJobRejected('rejected')).toBe(true);
  });

  it.each(['pending', 'confirmed', 'cancelled', 'completed', 'in_progress'] as const)(
    'is false for "%s"',
    (status) => {
      expect(isJobRejected(status)).toBe(false);
    },
  );

  it('fails closed on missing/unknown status', () => {
    expect(isJobRejected(undefined)).toBe(false);
    expect(isJobRejected(null)).toBe(false);
    expect(isJobRejected('nope' as Job['status'])).toBe(false);
  });
});

describe('isOrderTerminal', () => {
  it('is true for rejected and cancelled (order leaves the tech pool)', () => {
    expect(isOrderTerminal('rejected')).toBe(true);
    expect(isOrderTerminal('cancelled')).toBe(true);
  });

  it('is false for pending and active job statuses', () => {
    expect(isOrderTerminal('pending')).toBe(false);
    expect(isOrderTerminal('completed')).toBe(false);
  });
});

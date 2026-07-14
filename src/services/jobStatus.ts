/**
 * Job Status & Earnings Visibility
 *
 * Centralizes the single rule that governs when a technician's earnings may be
 * shown: earnings are revealed EXCLUSIVELY once a job reaches its definitive
 * completion state. For every other status — pending, confirmed, on_the_way,
 * arrived, in_progress, cancelled — the earnings amount must stay hidden so it
 * can never be displayed prematurely (before the job is actually finished).
 *
 * Keeping this as one testable source of truth (rather than inlining ad-hoc
 * `status === 'completed'` checks across screens) means the product rule can
 * never drift between the dashboard, the job details screen, and any future
 * surface, and it can be unit-tested directly.
 */

import type { Job } from '../types';

/**
 * Canonical job-status vocabulary. Mirrors the `jobs.status` CHECK constraint
 * in `supabase/migrations/00001_initial_schema.sql` so the client and DB agree
 * on the allowed values.
 */
export const JOB_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ON_THE_WAY: 'on_the_way',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  /** Post-completion sub-state: the job was finished, then an issue was reported. */
  REPORTED: 'reported',
  CANCELLED: 'cancelled',
} as const;

/**
 * Statuses in which a job is considered *definitively finished* and therefore
 * its earnings may be revealed.
 *
 * Only `'completed'` is the true completion trigger. `'reported'` is included
 * because it is a post-completion state — the job was already completed before
 * the issue was reported — so the technician's earnings remain valid and
 * visible. Every other status (including `'cancelled'`) keeps earnings hidden.
 */
export const COMPLETED_STATUSES: readonly Job['status'][] = ['completed', 'reported'];

/**
 * True only when the job status represents a finished job.
 *
 * Accepts a plain string (as well as the typed union) so it is safe to call
 * directly on raw values coming from the database, where an unexpected/legacy
 * value should fail closed (return false) rather than reveal earnings.
 */
export function isJobCompleted(
  status: Job['status'] | string | undefined | null
): boolean {
  if (!status) return false;
  return (COMPLETED_STATUSES as readonly string[]).includes(status);
}

/**
 * The core conditional rule: earnings are revealed ONLY after the job has been
 * marked completed (or reported, which implies completion).
 *
 * Returns false for any non-finished status (pending, confirmed, on_the_way,
 * arrived, in_progress, cancelled) or when the job/price is missing/ invalid,
 * so no earnings figure is ever surfaced prematurely.
 */
export function shouldRevealEarnings(
  job: Pick<Job, 'status' | 'totalPrice'> | Job | undefined | null
): boolean {
  if (!job) return false;
  if (!isJobCompleted(job.status)) return false;

  const price = Number(job.totalPrice);
  // A finished job with a non-numeric price has no earnings figure to show.
  if (!Number.isFinite(price)) return false;

  return true;
}

/**
 * Compute the technician's take-home earnings for a job.
 *
 * Earnings = service total × technician share %. Pure and side-effect free so
 * it can be reused by every earnings surface and unit-tested in isolation.
 * Returns 0 for any non-finite input rather than propagating NaN.
 */
export function computeTechnicianEarnings(
  totalPrice: number,
  technicianSharePercent: number
): number {
  const price = Number(totalPrice);
  const share = Number(technicianSharePercent);
  if (!Number.isFinite(price) || !Number.isFinite(share)) return 0;
  return (price * share) / 100;
}

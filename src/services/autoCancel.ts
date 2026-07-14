/**
 * Auto-cancel eligibility rules for unaccepted SAME-DAY orders (pure logic).
 *
 * This module contains ONLY the deterministic, framework-free helpers that
 * decide whether an order is subject to the 30-minute auto-cancel SLA and when
 * that deadline falls. It has NO dependency on Supabase, so it can be unit
 * tested in isolation and reused by the UI for live countdowns.
 *
 * The server-side enforcement lives in the `auto_cancel_unaccepted_orders()`
 * Postgres function (supabase/migrations/00019_auto_cancel_unaccepted_orders.sql)
 * and is invoked from `autoCancel.service.ts`. The logic here MUST stay in
 * sync with that SQL so what the UI predicts matches what the server does.
 *
 * Design contract (shared with the SQL function):
 *   - An order is eligible only when it is a SAME-DAY booking: its
 *     `scheduledDate` equals the calendar date it was `createdAt`, evaluated
 *     in the DEVICE's timezone (`localTz`, captured at booking), NOT UTC.
 *     Anchoring to the creation date (not "today") is what makes the
 *     near-midnight edge case safe: an order placed at 23:55 for "today"
 *     remains eligible after midnight and is cancelled at its 30-minute
 *     deadline rather than being skipped. Using the device timezone is what
 *     keeps the rule consistent with the clock the customer sees on their
 *     phone — a UTC-based check would wrongly skip early-morning / late-night
 *     bookings in any non-UTC zone.
 *   - The 30-minute window starts at `createdAt` (an absolute instant, so
 *     timezone does not affect its length).
 *   - Future-dated orders are never auto-cancelled.
 */

/** Acceptance SLA: an unaccepted same-day order is cancelled after this long. */
export const AUTO_CANCEL_TIMEOUT_MINUTES = 30;

/** Minimal shape needed to evaluate auto-cancel eligibility on the client. */
export interface AutoCancelOrderInput {
  /** Scheduled date as stored in the DB: 'YYYY-MM-DD'. */
  scheduledDate?: string | null;
  /** Creation timestamp as an ISO-8601 string (UTC, e.g. ends with 'Z'). */
  createdAt?: string | null;
  /**
   * IANA timezone captured at booking (e.g. 'Asia/Shanghai'). When present it
   * is used to derive the creation-day date so the "same-day" judgement matches
   * the customer's phone clock. Falls back to the live device tz when absent.
   */
  localTz?: string | null;
}

/**
 * Returns the device's IANA timezone, e.g. 'Asia/Shanghai'. Safe on platforms
 * where `Intl` is unavailable (returns 'UTC').
 */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Formats an ISO-8601 timestamp as 'YYYY-MM-DD' in the given IANA timezone.
 * Returns '' for invalid input. Uses `Intl` so daylight-saving transitions are
 * handled correctly.
 */
export function toLocalDateString(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    // Unknown tz name — degrade to UTC rather than throwing.
    return d.toLocaleDateString('en-CA', { timeZone: 'UTC' });
  }
}

/**
 * True when the order is a same-day booking: scheduled date === creation-date
 * in the DEVICE's timezone. Mirrors
 * `(scheduled_date = created_at AT TIME ZONE COALESCE(local_tz,'UTC')::date)`
 * in SQL.
 *
 * The creation-day date is derived in `localTz` (or the live device tz when
 * the stored value is missing) so the comparison matches what the customer
 * sees on their phone — not UTC.
 */
export function isSameDayOrder(
  order: AutoCancelOrderInput,
  deviceTz?: string
): boolean {
  if (!order.scheduledDate || !order.createdAt) return false;
  const tz = order.localTz || deviceTz || getDeviceTimeZone();
  const localCreatedDate = toLocalDateString(order.createdAt, tz);
  if (!localCreatedDate) return false;
  return order.scheduledDate === localCreatedDate;
}

/**
 * The moment the order will be auto-cancelled, or `null` when it is not
 * eligible (e.g. a future-dated order). Returns a `Date` the UI can count down.
 */
export function getAutoCancelDeadline(
  order: AutoCancelOrderInput,
  deviceTz?: string
): Date | null {
  if (!isSameDayOrder(order, deviceTz) || !order.createdAt) return null;
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + AUTO_CANCEL_TIMEOUT_MINUTES * 60_000);
}

/** Convenience: an order is currently inside its auto-cancel window. */
export function isAutoCancelEligible(
  order: AutoCancelOrderInput,
  deviceTz?: string
): boolean {
  return getAutoCancelDeadline(order, deviceTz) !== null;
}

/**
 * Milliseconds remaining until auto-cancel. `<= 0` means the deadline has
 * passed and the server should have (or will shortly) cancel it. Returns
 * `null` for orders that are not subject to auto-cancel (future-dated).
 *
 * @param now Overridable clock for tests.
 */
export function getAutoCancelRemainingMs(
  order: AutoCancelOrderInput,
  now: Date = new Date(),
  deviceTz?: string
): number | null {
  const deadline = getAutoCancelDeadline(order, deviceTz);
  if (!deadline) return null;
  return deadline.getTime() - now.getTime();
}

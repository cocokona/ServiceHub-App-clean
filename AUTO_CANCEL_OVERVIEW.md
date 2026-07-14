# Auto-Cancel Unaccepted Same-Day Orders — Overview

## What it does
An order placed in `order_in_progress` is **automatically cancelled** (status → `cancelled`) if **no technician accepts it within 30 minutes** — but **only when the order is scheduled for "today"**. Orders scheduled for a future date are never auto-cancelled by this rule.

## Key design decisions
- **Timezone follows the customer's phone, not UTC.** The original UTC-only check was wrong: a customer in China booking at 02:00 local (18:00 UTC the prior day) had `scheduled_date` = "today" but a UTC-derived creation date of "yesterday", so the order was never auto-cancelled. We now capture the **device timezone at booking** (`local_tz`, an IANA name like `Asia/Shanghai`) and anchor the same-day check to it:
  `scheduled_date = (created_at AT TIME ZONE COALESCE(local_tz, 'UTC'))::date`.
  The client helpers use the same `local_tz` (falling back to the live device tz), so the UI countdown and the server cancellation always agree.
- **"Scheduled for today" is anchored to the creation date** in that device timezone, not to the current date at runtime. This is what makes the **near-midnight edge case safe**: an order created at `23:55` for "today" still counts as a same-day order after midnight and is cancelled at its 30-minute deadline, instead of being silently skipped by a naive `scheduled_date = current_date` check.
- **Countdown starts at `created_at`** (creation). The 30-minute window is an absolute interval, so timezone does not affect its length. If an explicit assignment timestamp is introduced later, switch the anchor to `GREATEST(created_at, assigned_at)`.
- **Future-dated orders are excluded by construction** (their `scheduled_date` differs from the creation date in the device timezone).
- **Atomic, race-free**: each order is claimed with `FOR UPDATE SKIP LOCKED` and moved in a single `DELETE … RETURNING … INSERT` statement, mirroring `accept_order_in_progress`. A concurrent technician accept deletes the same row first, so this function processes zero rows for it — no duplicate job.
- On timeout the pending order is archived as a `cancelled` job (with `cancelled_reason` + `cancelled_at` + `local_tz`) so there is an auditable record, then removed from `order_in_progress`.

## Files changed
| File | Purpose |
|------|---------|
| `supabase/migrations/00019_auto_cancel_unaccepted_orders.sql` | `cancelled_reason`/`cancelled_at`/`local_tz` columns, partial index, `auto_cancel_unaccepted_orders()` function (device-tz aware), pg_cron scheduling (best-effort) |
| `src/services/autoCancel.ts` | Pure, Supabase-free eligibility helpers (device-tz aware, unit-tested, usable for UI countdowns) + `getDeviceTimeZone()` / `toLocalDateString()` |
| `src/services/autoCancel.service.ts` | `autoCancelUnacceptedOrders()` RPC wrapper + re-export of helpers |
| `src/services/index.ts` | Barrel exports |
| `src/types/index.ts` + `src/services/database.service.ts` | `Job.cancelledReason`/`cancelledAt`/`localTz` + mapper; `createOrderInProgress` captures `local_tz` at booking |
| `src/services/__tests__/autoCancel.test.ts` | 17 unit tests (UTC + Asia/Shanghai: early-morning, near-midnight, future-date) |

## How it runs
- **Supabase Pro+**: `pg_cron` schedules the function every minute automatically.
- **Other tiers**: call `supabase.rpc('auto_cancel_unaccepted_orders')` from an Edge Function / server cron on a ~1-minute cadence. The client helper `autoCancelUnacceptedOrders()` does exactly this.
- The client should use `getAutoCancelDeadline()` / `getAutoCancelRemainingMs()` for live "auto-cancels in mm:ss" countdowns, and rely on realtime/refetch for the actual status change.

## Verification
- `tsc --noEmit`: no new errors in `src/` (pre-existing `admin-dashboard` errors are unrelated).
- `vitest`: 17/17 new tests pass (UTC + Asia/Shanghai coverage).

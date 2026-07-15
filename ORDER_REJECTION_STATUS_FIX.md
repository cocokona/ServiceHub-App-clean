# Order Rejection → "Rejected" Status Fix & Customer Dialog

**Date:** 2026-07-15
**Problem:** After a technician rejected an order, the customer's order status
incorrectly stayed `"pending"`. The rejection only recorded a reason; the order
never transitioned to a terminal `rejected` state, so the customer orders page
could not reflect it and no actionable dialog was shown.

## Root cause
- `order_in_progress` had **no `status` column at all**. The app-side mapper
  `mapDbOrderToAppJob` (src/services/database.service.ts) *hardcoded*
  `status: 'pending'`, which is exactly why a rejected order never surfaced as
  REJECTED.
- The `reject_order_in_progress` RPC only set `last_rejection_reason`; it never
  changed the order status, and there was no customer-driven status change path.

## Fix summary

### DB (`supabase/migrations/00021_order_rejected_status.sql`)
- Added `order_in_progress.status` (`'pending' | 'rejected' | 'cancelled'`,
  default `'pending'`) + `rejected_at` / `cancelled_at` timestamps + index.
- `reject_order_in_progress` now also sets `status = 'rejected'` and stamps
  `rejected_at` (SECURITY DEFINER, caller-authorized).
- New `set_order_in_progress_status(p_order_id, p_status)` RPC (SECURITY
  DEFINER): **only the order owner (customer) may call it**. `'pending'`
  re-opens the order to the technician pool and clears the stale rejection
  reason/timestamp; `'cancelled'` stamps `cancelled_at`. Invalid statuses
  rejected.
- `NOTIFY pgrst` to reload PostgREST schema cache.

### Types & helpers
- `Job.status` union gained `'rejected'` (src/types/index.ts).
- `jobStatus.ts`: added `JOB_STATUS.REJECTED`, `isJobRejected()`, and
  `isOrderTerminal()` (rejected/cancelled remove the order from the tech pool).

### Service layer (src/services/database.service.ts)
- `mapDbOrderToAppJob` now reads `row.status` (was hardcoded `'pending'`) and
  maps `rejectedAt` / `cancelledAt`. **This is the actual bug fix.**
- New `setOrderInProgressStatus(orderId, status)` → calls the new RPC.
- `fetchAllOrdersInProgress` now filters `.eq('status', 'pending')` so a
  rejected/cancelled order leaves the technician browse pool.

### Data (status colors / tracking steps)
- `status-colors.json`: `rejected` (#ef4444) + `cancelled` for customer &
  technician palettes.
- `tracking-steps.json`: `statusInfo` + `statusIndex` entries for `rejected`
  and `cancelled` (so the Tracking header + timeline render sensibly).

### Customer UI
- **Tracking.tsx**
  - Local `orderStatus` state so a technician's rejection (→`rejected`) and the
    customer's choice (→`pending`/`cancelled`) update the view immediately.
  - Auto-opens a **rejection dialog** when the order is `rejected`, offering two
    clear actions:
    1. **Request a different technician** → `setOrderInProgressStatus('pending')`
       (re-opens to pool, clears reason), then returns to orders.
    2. **Cancel order & get full refund** →
       `setOrderInProgressStatus('cancelled')`, then returns to orders.
  - Persistent red banner explains the decline + reason, with a "Choose what to
    do →" link to re-open the dialog.
- **CustomerHome.tsx (My Orders)**
  - `useFocusEffect` refreshes `refreshJobs()` on screen focus → a rejected /
    cancelled / re-opened order's status is reflected **immediately** when the
    customer returns from Tracking (no manual pull-to-refresh needed).
  - Rejected order cards show an "Action needed — tap to choose what's next"
    hint and a "Choose next step" CTA instead of "Track".

## Verification
- `tsc --noEmit`: 0 errors in `src/`.
- `vitest`: **215/215 pass** (+22 new: status mapping, `fetchAllOrdersInProgress`
  pool filter, `setOrderInProgressStatus`, `isJobRejected`/`isOrderTerminal`).

## Notes / follow-ups
- **Refund processing**: the cancel action flips status to `cancelled` and the
  UI promises a full refund, but the actual payment-gateway refund is a backend
  concern (edge function / payment provider). Wire that to the `'cancelled'`
  transition when ready.
- **Real-time push**: the customer sees the new status on the orders page after
  returning (focus refresh). For live push while the orders page is already
  open, subscribe to `order_in_progress` UPDATEs via Supabase Realtime (optional
  enhancement).
- **Migration must be applied** to Supabase (CLI or dashboard SQL editor) before
  the new column/RPC are live; the trailing `NOTIFY pgrst` reloads PostgREST.

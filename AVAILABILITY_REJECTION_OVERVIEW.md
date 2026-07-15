# Technician Availability + Order Rejection — Implementation Overview

Delivered **2026-07-14** for ServiceHub Pro (React Native + Expo + Supabase).

This covers three requirements:
1. Technician availability slots start **closed by default**; opening is manual and persisted.
2. Technicians can **reject an assigned/pending order** by picking a predefined reason
   (`too_far`, `no_free`, plus more), via a data-driven, extensible list.
3. After a technician rejects, the chosen **reason is shown to the customer** on their order.

---

## 1. Initial Availability = Closed by Default

**Database** (`supabase/migrations/00020_*.sql`)
- `ALTER TABLE technician_availability ALTER COLUMN is_available SET DEFAULT false;`
  New slots are now closed unless explicitly opened.

**UI** (`src/screens/technician/TechnicianDashboard.tsx`)
- Both availability reads (`toggleAvailability` + Schedule render) now treat a
  missing slot as **closed** (`?? false` instead of `?? true`).
- On opening the Schedule tab, `seedTechnicianAvailability(technicianId)` seeds a
  full 7-day × 3-slot grid of **closed** rows for any technician who has none yet
  (idempotent — only seeds when empty). This makes the "all closed" invariant real
  at the data level and gives the toggle grid a complete starting state.
- Opening a slot still calls `setTechnicianAvailability(...)` → upsert → **persisted**.

**RPC** `seed_technician_availability(p_technician_id)` — `SECURITY DEFINER`,
authorized so a technician can only seed their own grid.

## 2. Order Rejection Flow

**Data model**
- New `order_rejections` table: `(order_id, technician_id, reason, created_at)` with a
  unique `(order_id, technician_id)` so a technician declines an order at most once.
- `order_in_progress.last_rejection_reason TEXT` — the customer-facing notice
  (technician identity is **never** stored here, only the reason → privacy).
- RLS: technicians can INSERT/SELECT **their own** rejections; **no customer policy**
  (the customer reads only the anonymous reason off their own order row).

**RPC** `reject_order_in_progress(p_order_id, p_technician_id, p_reason)`
- `SECURITY DEFINER`, authorized (`p_technician_id` must equal `auth.uid()`).
- Records the decline (upsert on conflict) and writes `last_rejection_reason` on the
  order. The order **stays in the pool** so other technicians can still take it —
  only the rejecting technician stops seeing it.

**Service layer** (`src/services/database.service.ts`)
- `rejectOrderInProgress(orderId, technicianId, reason)`.
- `fetchAllOrdersInProgress(category?, technicianId?)` — when `technicianId` is given,
  it excludes orders that technician has already rejected (reads their own
  `order_rejections`, then `.not('id','in', ...)`). Backward compatible when omitted.

**Predefined, extensible reasons** (`src/data/files/rejection-reasons.json`)
- Shipped: `too_far`, `no_free`, `skill_mismatch`, `schedule_conflict`,
  `outside_area`, `not_accepting`, `other`.
- Adding a reason = one JSON entry; no code change. Loaded via
  `rejectionReasons` / `getRejectionReasonLabel()` in `src/data`.

**UI** (`TechnicianDashboard.tsx` — Pending tab)
- Each order gets a **Decline** button (red outline) next to **Accept**.
- Tapping Decline opens a bottom-sheet reason picker from the data file.
- Selecting a reason calls `rejectOrderInProgress`, removes the order from the local
  list, re-syncs, and the server also excludes it on future pulls.
- `validateRejectionReason()` blocks an empty selection.

## 3. Customer Notification

**Service** `fetchOrderRejectionReason(orderId)` reads `last_rejection_reason` from the
customer's own order (RLS: `customer_id = auth.uid()`).

**UI** (`src/screens/customer/Tracking.tsx`)
- When the order is still `pending` and has a rejection reason, a red notice banner
  renders at the top: *"A technician was unable to take this order — Reason: <label>"*.
- A mount effect re-fetches the latest reason so the notice appears even if the
  in-memory job snapshot is stale. The reason label is resolved via
  `getRejectionReasonLabel()` (falls back to the raw id for unknown reasons).

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00020_technician_availability_default_and_rejections.sql` | New migration |
| `src/types/index.ts` | `RejectionReason` interface; `Job.rejectionReason`, `Job.rejectedAt?` |
| `src/data/files/rejection-reasons.json` | New data file (reasons) |
| `src/data/loader.ts` | Load `rejectionReasons`, `getRejectionReasonLabel()`, re-export type |
| `src/data/index.ts` | Barrel exports |
| `src/services/database.service.ts` | `rejectOrderInProgress`, `seedTechnicianAvailability`, `fetchOrderRejectionReason`, `fetchAllOrdersInProgress(technicianId)`, mapper adds `rejectionReason` |
| `src/services/validation.ts` | `validateRejectionReason()` |
| `src/screens/technician/TechnicianDashboard.tsx` | Closed-by-default availability + seed; Decline button + reason modal |
| `src/screens/customer/Tracking.tsx` | Rejection reason banner + live refresh |
| `src/services/__tests__/database.service.test.ts` | Tests for reject/seed/fetch-exclusion/reason mapping |
| `src/services/__tests__/validation.test.ts` | Tests for `validateRejectionReason` |

## Verification
- `tsc --noEmit` — **0 errors in `src/`** (the `admin-dashboard/` errors are a
  pre-existing, unrelated sub-project type mismatch).
- `vitest run` — **193/193 tests pass** (7 new for this feature).

## Deployment Note
The SQL migration must be applied to the Supabase project (e.g. via the Supabase
CLI / dashboard SQL editor) before the new RPCs, column, and table are live. The
`NOTIFY pgrst, 'reload schema';` at the end refreshes PostgREST so the client sees
the new objects.

## Design Decision (worth flagging)
The order stays in the technician pool after a rejection so other technicians can
still accept it (marketplace model) — only the rejecting technician's browse list
drops it. The customer sees the reason on their still-pending order. If you'd instead
prefer a **terminal "declined" status** that removes the order from the pool entirely
and shows a final declined state, that's a small follow-up (add a `rejected` status to
the `jobs`/`order_in_progress` CHECK + a matching UI state). The current approach
keeps the existing status machine untouched and is lower-risk.

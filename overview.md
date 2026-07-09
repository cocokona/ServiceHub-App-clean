# Fix: Order Technician Assignment ("Select Technician")

## What was broken

The customer order flow pulled technicians but the **selection never reached the database as a real reference**, and there was **no "active" filtering or validation**. Concretely:

1. **Missing data binding (the core bug).** `ServiceDetails.handleNext` only copied `technicianName` / `technicianAvatar` into `bookingData`. The technician's `id` was dropped, so:
   - `Job` had no `technicianId` field,
   - the two DB mappers never read `technician_id`,
   - `createOrderInProgress` and `createJob` never wrote the `technician_id` column.
   → The chosen technician was persisted only as a free-text name string, not as a validated FK. If names changed or collided, the assignment was ambiguous/lost.
2. **No "active" filter.** `fetchTechnicians` returned every non-deleted technician; there was no way to hide a deactivated account.
3. **No validation / stale preselection.** A technician wasn't required, and a preselected local "Recommended" entry (not a real DB id) could silently remain selected even when it wasn't in the active list.

## What changed

**Database**
- `supabase/migrations/00007_add_profiles_is_active.sql` — adds `is_active BOOLEAN NOT NULL DEFAULT true` to `profiles`, a partial index for active technicians, and a `NOTIFY pgrst` schema reload.

**Data layer (`src/services/database.service.ts`)**
- `fetchTechnicians` now filters `.eq('is_active', true)` (DB-level) in addition to role + `deleted_at`.
- `Job` type gained `technicianId?` (`src/types/index.ts`).
- `mapDbJobToAppJob` and `mapDbOrderToAppJob` map `technician_id → technicianId`.
- `createOrderInProgress` (both the primary and the 23503-retry INSERT) and `createJob` now write `technician_id`.

**UI — `src/screens/customer/ServiceDetails.tsx`**
- Loading spinner + empty state for the technician list.
- `handleNext` **requires** a valid technician and persists `technicianId` into `bookingData`.
- When the DB list loads, any preselected technician that isn't in the active list is cleared (kills stale local preselections).

**UI — `src/screens/customer/Checkout.tsx`**
- `handlePay` validates `bookingData.technicianId` exists before saving (aborts with an alert if missing) and passes it to `createOrderInProgress`.

**Tests**
- Added 2 cases (active-only filter; `technician_id` persisted + mapped back). `npm test` → **46 passed**, `tsc --noEmit` → clean.

## Action required
Run migration `00007` against your Supabase project so the `is_active` column exists; otherwise the technician query will fail on the missing column. After that, only active technicians appear in "Select Technician", the chosen one is stored as `technician_id`, and the order save is validated.

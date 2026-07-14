# Fix: Repair technicians could accept cleaning jobs

## Root cause
A technician account with `work_category = 'repair'` was able to accept a cleaning order because **no role/category check existed anywhere in the acceptance path**:

1. The `accept_order_in_progress` database function performed **no category validation**.
2. `TechnicianDashboard.handleAcceptOrder` only verified the technician had a phone number — it never compared the technician's specialty to the job's category.
3. The Pending tab called `fetchAllOrdersInProgress()` with **no category filter**, so a repair tech was even shown cleaning jobs to accept.

## Fix (defense in depth)

### 1. Client-side validation gate — `src/services/validation.ts`
Added `validateTechnicianCanAcceptJob({ technicianWorkCategory, jobServiceCategory })`:
- Allows acceptance only when the technician's `work_category` matches the job's `service_category`.
- Universal technicians (`work_category` null or `'all'`) may take any job.
- Fails **closed** when the job category is missing/unknown.

### 2. Enforce in the accept flow — `src/screens/technician/TechnicianDashboard.tsx`
- `handleAcceptOrder` now calls the validator right after the phone check; on mismatch it shows a friendly Alert and returns **without** calling the server.
- The Pending orders list now filters by the technician's `work_category` (`fetchAllOrdersInProgress(user?.workCategory)`), so incompatible jobs (e.g. a repair tech viewing a cleaning job) never appear in the browse list.
- `handleAcceptOrder` signature gained a `serviceCategory` parameter (passed from the call site).

### 3. Database-level backstop — `supabase/migrations/00017_role_based_job_acceptance.sql`
`accept_order_in_progress()` now reads the technician's `work_category` and raises
`Technician category mismatch: specialist in <x>, cannot accept <y> job`
when the categories differ (and the tech is not universal). This is the authoritative
guard against any client-side bypass. Keeps `SECURITY DEFINER` + `NOTIFY pgrst`.

## Verification
- New unit tests for `validateTechnicianCanAcceptJob` (6 cases, incl. repair≠cleaning blocked, `all`/null allowed, missing category blocked).
- Full `src/services` suite: **99 tests pass**.
- `tsc --noEmit`: no errors in the touched files.

## Behavior after fix
| Technician `work_category` | Job `service_category` | Can accept? |
|---|---|---|
| `repair` | `repair` | ✅ |
| `repair` | `cleaning` | ❌ (blocked client + server) |
| `cleaning` | `cleaning` | ✅ |
| `all` / null | any | ✅ |

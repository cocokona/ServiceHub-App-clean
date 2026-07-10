# Technician Checklist Fix — Overview

## Problem
The technician-side **Task Checklist** rendered empty even though the customer had
selected add-on services during booking. Additionally, when a technician added a
service add-on in the active session, it never appeared in the checklist.

## Root Cause
The `Job.checklist` field was never populated from the customer's selections:
- `mapDbOrderToAppJob` (`src/services/database.service.ts`) **hardcoded `checklist: []`**
  for every pending order in `order_in_progress`.
- `mapDbJobToAppJob` only read from the `job_checklists` child table, which is
  **never seeded** anywhere — so accepted jobs also had an empty checklist.
- The customer's selections actually live in `focusAreas` (the add-on service labels
  checked in `ServiceDetails`), but nothing mapped them into the checklist.
- In `ActiveService.tsx`, the "Add Service Add-on" action only added price — it never
  appended a checklist task.

## Changes
1. **`src/services/database.service.ts`**
   - Added `buildChecklistFromFocusAreas(focusAreas, persistedChecklist?)`: prefers any
     persisted `job_checklists` rows, otherwise derives `{ text, completed: false }[]`
     from the customer's `focus_areas`.
   - Both `mapDbOrderToAppJob` and `mapDbJobToAppJob` now seed the checklist from the
     customer's selected items.

2. **`src/screens/technician/ActiveService.tsx`**
   - Checklist state is seeded from `job.checklist` (now derived) or falls back to
     `focusAreas`.
   - The "Add Service Add-on" button now **also appends a checklist task** (named after
     the add-on, defaulting to "Additional Service").
   - `handleComplete` carries the live `checklist` into `ServiceCompletion` so additions
     survive into the summary.

3. **`src/screens/technician/JobDetails.tsx`** and **`ServiceCompletion.tsx`**
   - Added empty-state guards so a job with no checklist shows a friendly message
     instead of a blank/erroring list.

4. **`src/data/loader.ts`**
   - `parseJobs` derives the checklist from `focusAreas` for in-memory mock data too,
     keeping the data layer consistent.

## Verification
- `tsc --noEmit` — zero type errors.
- `database.service.test.ts` — 12/12 passing.
- Note: 2 failing tests exist in the untracked `location.service.test.ts` (a newly added
  `location.service` module unrelated to this fix). They were not touched.

## Result
The technician Task Checklist now correctly displays the items the customer selected,
and any service add-on added during the visit is automatically included as a checklist
task.

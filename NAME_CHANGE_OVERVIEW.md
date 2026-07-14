# Display Name Change — Implementation Overview

A validated, database-first display-name editor added to both profile screens of
**ServiceHub-App** (React Native + Expo + Supabase). The user can update the name
shown across the entire app; the new name is written to the database *before* the UI
reflects it, and it syncs instantly to every screen that shows the user's name.

## What was built

### 1. Validation — `src/services/validation.ts`
- `validateDisplayName(raw)` — single source of truth shared by UI and service layer.
  - Trims whitespace; rejects empty input.
  - Length `2–50` characters (`DISPLAY_NAME_MIN` / `DISPLAY_NAME_MAX`).
  - Requires at least one letter (so `---` / `'  '` are rejected).
  - Allows **letters (any language via `\p{L}`), spaces, hyphens, apostrophes only**.
  - Returns `{ isValid, error, normalized }` with a friendly, user-safe message.

### 2. Database update — `src/services/auth.service.ts`
- `updateDisplayName(raw)` — validates first (no DB hit on invalid input), then writes
  `profiles.name` via Supabase. RLS restricts the update to the owner (`id = auth.uid()`).
  Returns the refreshed `User` on success or a friendly `error` otherwise.

### 3. Reusable UI — `src/components/DisplayNameEditor.tsx`
- Inline "Edit" → `TextInput` with **live validation** (red error text + `n / 50` counter).
- Save is disabled while invalid or saving. On Save it **awaits the DB write first**, then
  calls `onSaved(user)` (wired to `setUser`) and shows a green **"Display name updated"**
  confirmation banner. DB failures surface an `Alert`.

### 4. Integration
- `CustomerHome` (Profile tab) and `TechnicianDashboard` (Profile tab) both render
  `<DisplayNameEditor user={user} onSaved={setUser} />`.
- Removed the now-redundant `name` field from the customer's combined Edit-Profile form
  so the validated path is the **only** way to change a name.

## Cross-app synchronization
`setUser` updates `AppContext`, which re-renders every component reading `user?.name`
(profile header, technician "Hello" greeting, avatar initials, Checkout customer name,
etc.) and persists to `AsyncStorage`. Historical order/job `customerName` values are
intentionally order-time snapshots and are not retroactively rewritten.

## Verification
- `src/services/__tests__/displayName.test.ts` — 10 new unit tests (validation boundaries
  + `updateDisplayName` DB-first write / error passthrough).
- Full service suite: **109 tests pass**. `tsc --noEmit` clean for all changed files
  (the unrelated `admin-dashboard/` React-type errors are pre-existing and outside scope).

## Files changed
- `src/services/validation.ts` (added `validateDisplayName`, constants)
- `src/services/auth.service.ts` (added `updateDisplayName`)
- `src/services/index.ts` (exported `validateDisplayName` + constants)
- `src/components/DisplayNameEditor.tsx` (new reusable editor)
- `src/screens/customer/CustomerHome.tsx` (integrated editor; removed name from combined edit)
- `src/screens/technician/TechnicianDashboard.tsx` (integrated editor)
- `src/services/__tests__/displayName.test.ts` (new tests)

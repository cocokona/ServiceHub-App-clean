# Checkout "Your profile was not found" — Root Cause & Fix

## What actually happened
The `Console Error` at `Checkout.tsx:43` was **not** a checkout bug. The real
failure was upstream:

`createOrderInProgress` inserts a row into `order_in_progress` with
`customer_id = user.id`. That column has a foreign key to `profiles(id)`.
The currently signed-in user had **no `profiles` row** (their account predates
the `on_auth_user_created` signup trigger, or the profile was lost). Postgres
rejected the insert with **SQLSTATE 23503**, and the data layer translated that
into `"Your profile was not found. Please sign out and sign in again."`

That message was misleading — `signIn` never creates a profile, so re-logging
in could not have fixed it.

## Fix (defense in depth)

### 1. App-layer self-heal (`database.service.ts`)
- New `ensureProfile()`: if the current session has no `profiles` row, it
  creates one from the auth user's metadata. Idempotent (SELECT-then-INSERT),
  allowed by the existing `profiles_insert_self` RLS policy (`id = auth.uid()`).
- `createOrderInProgress` now catches the 23503, calls `ensureProfile()`, and
  **retries the insert once**. The scary error only triggers if recovery fails.
  The thrown message text is unchanged (project contract: never change exported
  error messages).

### 2. Proactive guard at the edges
- `Checkout.handlePay` calls `ensureProfile()` before placing the order.
- `AppNavigator` calls `ensureProfile()` whenever a user session is established,
  protecting **every** FK-dependent write (jobs, messages, reviews).
- `auth.service.getCurrentUser` / `refreshSession` self-heal too, so a missing
  profile is never misinterpreted as "logged out".

### 3. Data-layer repair (`supabase/migrations/00006_backfill_profiles.sql`)
- Backfills a `profiles` row for **every** `auth.users` missing one.
- Idempotently rebuilds the `on_auth_user_created` trigger.
- `NOTIFY pgrst, 'reload schema'` so the new rows are immediately visible.

## Verification
- `npx tsc --noEmit` — 0 errors.
- `npm test` (Vitest) — **44/44 pass** (updated test mocks for
  `supabase.auth.getSession` and builder `.maybeSingle()`).
- The 23503 path still throws the original friendly message when recovery is
  genuinely impossible (contract preserved).

## To deploy
Run migration `00006_backfill_profiles.sql` against the Supabase project. The
app-side changes need no migration to function (runtime self-heal covers it),
but the backfill keeps historical data and analytics consistent.

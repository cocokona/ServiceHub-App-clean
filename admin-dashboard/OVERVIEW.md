# ServiceHub Admin Dashboard — Live Data Integration

The admin dashboard now fetches **real application data** from the same Supabase
project the mobile app uses. All mock/placeholder data has been removed.

## What changed

| Area | Before | After |
|------|--------|-------|
| Data source | Hardcoded `src/data/mock.ts` | `src/data/queries.ts` → Supabase (same project as the app) |
| Auth | None (everyone saw fake data) | Supabase Auth gate (`src/components/AuthGate.tsx`) |
| States | None | Loading / Error / Empty states on every page |
| Chat | Static threads | Live threads + realtime subscriptions (`subscribeMessages`) |
| Settings | Static | Reads & writes the logged-in user's `profiles` row |

## Architecture & security (important)

- The dashboard uses the **Supabase public anon key** (`VITE_SUPABASE_ANON_KEY`)
  through `src/lib/supabase.ts`. Per the project security policy this key is
  safe in the browser — every row is enforced by **Row Level Security**. The
  `service_role` key is **never** embedded client-side.
- **Admin-only console.** The dashboard is for company administrators, not
  technicians or customers. `src/App.tsx` refuses any authenticated user whose
  `profiles.is_admin` is not `true` with a clear "Admin access only" screen
  (with sign-out). The seeded technician accounts (`repair@…`, etc.) are now
  **denied** at the gate.
- Data visibility follows RLS; only `is_admin` accounts get platform-wide access:
  - **Admin login** (`admin@servicehub.test` / `Admin@2026!`, seeded via
    `00016_admin_bootstrap.sql`) sees **all jobs, orders, messages, payments,
    profiles, and reviews** via the admin RLS policies in `00015_admin_rls.sql`.
  - **Technician/customer logins are blocked** at the app gate before any data
    is shown.
- Queries are wrapped in a `useQuery` hook (`src/hooks/useQuery.ts`) with
  unmount-safe cancellation, so stale responses never land in the UI.

## Provisioning the admin account (one-time)

Apply the two additive migrations in the Supabase SQL Editor (or `supabase db push`),
in order:

1. `supabase/migrations/00015_admin_rls.sql` — adds `is_admin` column + admin RLS
   policies.
2. `supabase/migrations/00016_admin_bootstrap.sql` — expands the `role` CHECK to
   allow `'admin'`, then creates `admin@servicehub.test` (confirmed email,
   `is_admin = true`).

Then sign in with:

```
email:    admin@servicehub.test
password: Admin@2026!
```

> Change this password before any production / shared deployment. To promote an
> existing account instead, run `UPDATE public.profiles SET is_admin = true
> WHERE email = 'you@…';` after applying 00015.

## Pages → live data

- **Dashboard** — KPIs (orders, revenue, customers, avg rating) with week-over-week
  deltas; order-volume trend; top technicians (real completion % from jobs).
- **Order Management** — union of `order_in_progress` + `jobs`, live search &
  status filters, per-status counts.
- **Analytics** — order trend, monthly completed-vs-new revenue, technician
  performance, customer activity donut (active/idle/churned from real order dates).
- **Messages** — conversations derived from `messages` grouped by job, real-time
  inserts, admin sends as `support` role.
- **Settings** — loads & saves the admin's own `profiles` row (name/phone/city).

## How to run

```bash
cd admin-dashboard
cp .env.example .env        # already created locally with the anon key
npm install
npm run dev                 # http://localhost:5173
```

Log in with the admin account (`admin@servicehub.test` / `Admin@2026!`) after
applying migrations `00015` + `00016`. Technician/customer accounts are refused.

## Verification

- `npm run build` passes (type-check + bundle, ~127 KB gzip JS incl. Supabase).
- A live query test against the real database returned real rows:
  orders `#SH-6047` (Deep Cleaning), `#SH-3879` (Home Repair); 4 technicians
  with ratings; real customer counts. The dashboard renders this on login.

## Design fidelity

All OmnAdmin **Pro-Density** design tokens, layout, typography, charts, and
responsive behavior (sidebar → mobile drawer, single-pane chat on mobile) are
preserved. Only the data source changed — UI/UX is unchanged.

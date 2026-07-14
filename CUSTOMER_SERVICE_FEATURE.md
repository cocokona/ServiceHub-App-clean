# Customer Service Chat — Feature Overview

**Goal:** Add a customer-service button in the top-right corner of both the **customer** and
**technician** profile pages. Tapping it opens a real chat that is connected to the website's
admin panel, so users and the support team can communicate directly.

## What changed

### 1. Database (must be applied to Supabase)
- **`supabase/migrations/00018_support_threads.sql`** (new)
  - New `support_threads` table (one open conversation per user).
  - `messages.job_id` made nullable; added nullable `support_thread_id` FK + a CHECK that every
    message targets exactly one of (job | support thread).
  - RLS: thread owners + admins can read/write; admins can read/write all.
  - `trg_touch_support_thread` keeps `updated_at` fresh on new messages.
  - Both tables added to `supabase_realtime` (idempotent).

> ⚠️ **Action required:** Run this migration against the shared Supabase project
> (e.g. `supabase db push` or paste into the SQL editor). Until then the feature cannot persist
> messages. The admin + mobile apps already share this project, so no other config is needed.

### 2. Mobile app (`src/`)
- **`src/services/chat.service.ts`** (new) — real backend chat layer:
  `getOrCreateSupportThread`, `fetchMessages`, `subscribeMessages` (realtime), `sendMessage`.
  Replaces the old mock-only behaviour.
- **`src/screens/customer/SupportChat.tsx`** (rewritten) — now real, supports two modes:
  - **Job mode** (`route.params.job`) — opened from Tracking / JobDetails (unchanged entry points).
  - **Support mode** (`route.params.support`) — opened from the profile button, no job required.
  - Reads/writes the same `messages` table the admin console consumes.
- **`src/components/SupportLauncher.tsx`** (new) — the pink, shadowed top-right button that
  navigates to `SupportChat` in support mode.
- **`src/screens/customer/CustomerHome.tsx`** & **`src/screens/technician/TechnicianDashboard.tsx`**
  — `SupportLauncher` added to the top-right of the Profile tab header.

### 3. Admin console (`admin-dashboard/`)
- **`src/data/types.ts`** — `ChatMessage` gains nullable `jobId`/`threadId`; new `SupportThread`.
- **`src/data/queries.ts`** — `getSupportThreads`, `getSupportMessages`, `subscribeSupportMessages`,
  `sendSupportMessage` (plus `mapSupportMessage`).
- **`src/pages/Messages.tsx`** — new **Job Chats / Support** toggle. The Support tab lists support
  threads (user name + role badge), lets the admin read/reply, and refreshes live when a user
  messages (realtime on `support_threads`).

## How the connection works
1. User taps the profile button → `SupportChat` (support mode).
2. `getOrCreateSupportThread` finds/creates their `support_threads` row.
3. Messages are inserted into `messages` with `support_thread_id` set.
4. The admin `Messages` page (Support tab) reads those same rows and replies with
   `sender_role = 'support'`. Realtime keeps both sides live.
5. New user messages also bump the admin's unread badge (existing `MessageCountContext`).

## Verification
- `npx tsc --noEmit` → **0 errors** in `src/` (mobile) and clean in `admin-dashboard/`.
- `npx vitest run` → **165 tests pass** (incl. 14 new `chat.service` tests covering
  get-or-create, fetch, and send).

## Notes / follow-ups
- The previously-mock `SupportChat` is now fully backed by Supabase, so the **job** chats from
  Tracking / JobDetails are also genuinely connected to admin (previously they were mock-only).
- Optional future polish: auto-resolve a thread to `resolved` when the admin closes it, or surface
  unread counts per support thread.

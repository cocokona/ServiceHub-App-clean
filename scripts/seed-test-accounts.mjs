#!/usr/bin/env node
/**
 * Seed three provider test accounts (repair / electrical / beauty) in Supabase.
 *
 * WHY THIS APPROACH (the recommended, Supabase-native way):
 *  - Uses the Supabase Admin API (service_role) — the supported, future-proof
 *    way to create users programmatically. No fragile raw SQL on auth.users.
 *  - `email_confirm: true` marks the account verified immediately, so NO
 *    confirmation email is sent and NO real inbox is required.
 *  - Fake/dev emails (e.g. *.servicehub.test) are accepted because Supabase
 *    only validates email FORMAT, not deliverability.
 *  - `role` + `work_category` are passed in user_metadata, which your existing
 *    `handle_new_user()` trigger copies into public.profiles automatically —
 *    so the RBAC data is created for you.
 *
 * SECURITY — READ THIS:
 *  - NEVER ship this script or the service_role key inside the mobile app.
 *    service_role BYPASSES Row Level Security. Keep it in CI / a local dev
 *    script only. The app itself must keep using the anon key.
 *  - Do NOT commit the service_role key. Export it in your shell (see below).
 *
 * USAGE:
 *  1. Get the Service Role key from Supabase Dashboard → Project Settings → API
 *     (it is a different key from the anon/public key).
 *  2. Export the values (do NOT put them in a committed .env):
 *       export SUPABASE_URL="https://xxxx.supabase.co"
 *       export SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..."
 *  3. (Optional) override the dev password:
 *       export DEV_PASSWORD="test1234"
 *  4. Run from the project root:
 *       node scripts/seed-test-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Export them in your shell (see the header comment). Do NOT commit them.'
  );
  process.exit(1);
}

// Dev-only password for the throwaway accounts. Change freely.
const DEV_PASSWORD = process.env.DEV_PASSWORD || 'test1234';

// The three provider accounts you asked for. They map to:
//   role = 'technician'  (NOT 'customer')
//   work_category = 'repair' | 'electrical' | 'beauty'
const accounts = [
  { email: 'repair@servicehub.test',   name: 'Repair Tech',   work_category: 'repair' },
  { email: 'electrical@servicehub.test', name: 'Electrical Tech', work_category: 'electrical' },
  { email: 'beauty@servicehub.test',    name: 'Beauty Tech',   work_category: 'beauty' },
];

// service_role client — bypasses RLS, used only for this admin operation.
//
// NOTE: supabase-js ALWAYS constructs its RealtimeClient in the constructor,
// and that constructor eagerly resolves a WebSocket implementation via
// getWebSocketConstructor(). On Node < 22 there is no global WebSocket, so it
// throws — even when realtime is disabled (the disabled flag only stops it
// from *connecting*, not from being *constructed*). We therefore pass a no-op
// transport class so construction succeeds. Because realtime is disabled, this
// stub is never actually used to open a socket. This keeps the script runnable
// on Node 18 / 20 / 22+ with no extra dependencies.
class NoopWebSocket {}
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { disabled: true, transport: NoopWebSocket },
});

async function createAccount({ email, name, work_category }) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true, // <-- bypasses email verification (no email sent)
    user_metadata: {
      name,
      role: 'technician', // <-- first-class role, not 'customer'
      work_category,
    },
  });

  if (error) {
    // 409 / "already registered" → treat as success so the script is re-runnable.
    const alreadyExists =
      error.status === 409 ||
      /already registered|already been registered/i.test(error.message || '');
    if (alreadyExists) {
      console.log(`• ${email} already exists — skipped`);
      return;
    }
    throw error;
  }
  console.log(`✓ created ${email}  (role=technician, work_category=${work_category})`);
}

(async () => {
  console.log('Seeding provider test accounts...\n');
  for (const acc of accounts) {
    await createAccount(acc);
  }
  console.log('\nDone. Sign in with these emails + the dev password.');
  console.log(
    'Tip: also turn OFF "Confirm email" in Auth → Providers → Email so the app\'s own signUp skips verification too.'
  );
})().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});

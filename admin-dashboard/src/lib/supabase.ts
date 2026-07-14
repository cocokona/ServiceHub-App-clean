import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup so misconfiguration is caught immediately.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n' +
      'Copy .env.example to .env and fill in your Supabase project values.'
  );
}

// The dashboard uses the Supabase PUBLIC anon key. Per the project security
// policy this key is safe to expose in the browser — every row is gated by
// Row Level Security. Admin-wide access is granted to logged-in admin users
// through RLS policies (see supabase/migrations/00015_admin_rls.sql), never by
// embedding the service_role key in client code.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    db: { schema: 'public' },
    global: { headers: { 'X-Client-Info': 'servicehub-admin' } },
  }
);

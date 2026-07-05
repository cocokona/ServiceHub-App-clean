import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Supabase Client — Refactored
 *
 * Key changes from the original:
 * 1. Config is read from environment variables (not hardcoded)
 * 2. AsyncStorage is wired as the persistent session store
 * 3. Auto-refresh tokens enabled for seamless session management
 * 4. Schema cache is explicitly set to 'public'
 *
 * SECURITY: The anon key is safe to expose in client code — it only grants
 * access permitted by Row Level Security policies. Never expose the
 * service_role key in the app.
 */

// In Expo, env vars prefixed with EXPO_PUBLIC_ are bundled at build time.
// For local dev without env vars, fall back to the existing project config.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://dusugfdsuzeutjnkhtug.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '***REMOVED_ANON_KEY***';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist the JWT session on the device so users stay logged in
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    // Explicitly target the public schema — this is what populates schema.cache
    schema: 'public',
  },
  global: {
    headers: { 'X-Client-Info': 'servicehub-mobile' },
  },
});

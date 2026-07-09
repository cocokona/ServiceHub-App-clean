import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseUrl, supabaseAnonKey } from '../config/env';

/**
 * Supabase Client — Refactored
 *
 * Connection credentials (URL + anon key) are read from the centralized
 * environment config at src/config/env.ts. No hardcoded values here.
 *
 * SECURITY: The anon key is safe to expose in client code — it only grants
 * access permitted by Row Level Security policies. Never expose the
 * service_role key in the app.
 */

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

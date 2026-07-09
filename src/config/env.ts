/**
 * Centralized Environment Configuration
 *
 * ALL environment-sensitive configuration (Supabase URL, anon key, API base
 * URL) is read here from Expo public environment variables. No other file in
 * the app should hardcode connection strings or credentials.
 *
 * Usage:
 *   import { supabaseUrl, supabaseAnonKey } from '@/config/env';
 *
 * Env vars are defined in:
 *   .env          — local development (git-ignored)
 *   .env.example  — template (committed)
 *
 * In Expo, any variable prefixed with EXPO_PUBLIC_ is inlined at build time.
 */

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

/**
 * Supabase project URL.
 * Must be set in EXPO_PUBLIC_SUPABASE_URL — no hardcoded fallback.
 * If missing, the app will throw at startup rather than silently failing.
 */
export const supabaseUrl: string = requireEnv('EXPO_PUBLIC_SUPABASE_URL');

/**
 * Supabase anon public key.
 * Safe to expose in client code — access is gated by Row Level Security.
 * NEVER use the service_role key in client code.
 */
export const supabaseAnonKey: string = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Reads an environment variable and throws a descriptive error if it is
 * missing or empty. This fails fast at module load time so misconfigured
 * deployments are caught immediately — not at the first API call.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[config/env] Missing required environment variable: ${name}.\n` +
        `Create a .env file based on .env.example and restart the app.`
    );
  }
  return value;
}

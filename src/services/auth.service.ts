import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { logger } from './logger';
import { ensureProfile } from './database.service';

/**
 * Auth Service — Refactored
 *
 * Replaces the old approach of directly querying a custom `users` table with
 * plaintext passwords. Now uses Supabase Auth (JWT-based, bcrypt-hashed
 * passwords) and reads profile data from the `profiles` table that is
 * auto-created by a database trigger on signup.
 *
 * Why this matters:
 * - Passwords are hashed by Supabase Auth (never stored in plaintext)
 * - JWT sessions are managed automatically (persist, refresh, expire)
 * - RLS policies enforce row-level access control
 * - Email verification & password reset are available out of the box
 */

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'technician';
  workCategory?: string;
}

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Map a Supabase auth session + profile row into the app's User type.
 */
function mapToUser(profile: any): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    workCategory: profile.work_category ?? undefined,
    bio: profile.bio ?? undefined,
    phone: profile.phone ?? undefined,
    hourlyRate: profile.hourly_rate ? Number(profile.hourly_rate) : undefined,
    address: profile.address ?? undefined,
    apartment: profile.apartment ?? undefined,
    city: profile.city ?? undefined,
    zipCode: profile.zip_code ?? undefined,
    rating: profile.rating ? Number(profile.rating) : undefined,
    reviewsCount: profile.reviews_count ?? undefined,
  };
}

/**
 * Register a new account.
 *
 * Flow:
 *  1. Call supabase.auth.signUp() — Supabase hashes the password and creates
 *     an entry in auth.users.
 *  2. The `on_auth_user_created` trigger automatically inserts a row into
 *     public.profiles with the email, name, and role from user_metadata.
 *  3. If email confirmation is disabled (dev), the session is active
 *     immediately. We fetch the profile and return it.
 */
export async function signUp({
  email,
  password,
  name,
  role,
  workCategory,
}: SignUpParams): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();

  // Step 1: Create the auth user with metadata (the trigger reads these)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        name,
        role,
        work_category: workCategory ?? null,
      },
    },
  });

  if (authError) {
    logger.error('[auth:signUp] signup failed', { email: cleanEmail, code: (authError as any).status });
    return { user: null, error: authError.message };
  }

  if (!authData.user) {
    logger.warn('[auth:signUp] no user returned');
    return { user: null, error: 'Registration failed — no user returned.' };
  }

  logger.info('[auth:signUp] account created', { email: cleanEmail, hasSession: !!authData.session });

  // Step 2: If email confirmation is required, there is no session yet
  if (!authData.session) {
    return {
      user: {
        id: authData.user.id,
        email: cleanEmail,
        name,
        role,
        workCategory: workCategory ?? undefined,
      },
      error: null,
    };
  }

  // Step 3: Fetch the profile row (created by trigger)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    // Profile may not be ready yet — return a minimal user from auth metadata
    return {
      user: {
        id: authData.user.id,
        email: cleanEmail,
        name,
        role,
        workCategory: workCategory ?? undefined,
      },
      error: null,
    };
  }

  return { user: mapToUser(profile), error: null };
}

/**
 * Sign in with email + password.
 *
 * Uses Supabase Auth — password is verified against the bcrypt hash stored
 * in auth.users. Never queries a plaintext password column.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

  if (authError) {
    logger.error('[auth:signIn] sign in failed', { email: cleanEmail, code: (authError as any).status });
    return { user: null, error: authError.message };
  }

  if (!authData.user) {
    logger.warn('[auth:signIn] no user returned');
    return { user: null, error: 'Login failed — no user returned.' };
  }

  logger.info('[auth:signIn] signed in', { email: cleanEmail });

  // Fetch the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return {
      user: {
        id: authData.user.id,
        email: cleanEmail,
        name: authData.user.user_metadata?.name ?? cleanEmail,
        role: authData.user.user_metadata?.role ?? 'customer',
      },
      error: null,
    };
  }

  return { user: mapToUser(profile), error: null };
}

/**
 * Sign out and clear the local session.
 */
export async function signOut(): Promise<void> {
  logger.info('[auth:signOut] signing out');
  await supabase.auth.signOut();
}

/**
 * Resend email confirmation link.
 * Call this when the user didn't receive the confirmation email.
 * Supabase rate-limits this endpoint — it may return an error if called too frequently.
 */
export async function resendConfirmation(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  return { error: error ? error.message : null };
}

/**
 * Check whether the current session is active.
 * Useful after the user clicks the confirmation link and returns to the app.
 */
export async function refreshSession(): Promise<AuthResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return { user: null, error: error?.message ?? 'No active session' };
  }

  // Self-heal: a missing profile must not force a logout. Ensure it exists,
  // then read it back so the returned user is fully populated.
  const profileReady = await ensureProfile();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile) {
    return { user: mapToUser(profile), error: null };
  }

  if (profileReady) {
    // Profile was just created but not yet returned — retry once.
    const { data: retry } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (retry) return { user: mapToUser(retry), error: null };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
      name: session.user.user_metadata?.name ?? '',
      role: session.user.user_metadata?.role ?? 'customer',
    },
    error: null,
  };
}

/**
 * Get the current session and profile on app launch.
 * Returns null if no active session exists.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // Self-heal: ensure the profile row exists before reading it. Without this,
  // an account missing a profile would be reported as "no user" and logged out
  // even though the auth session is perfectly valid.
  await ensureProfile();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile) return null;

  return mapToUser(profile);
}

/**
 * Update the current user's profile fields.
 * RLS ensures only the owner can update their own profile.
 */
export async function updateProfile(
  updates: Partial<
    Pick<
      User,
      'name' | 'phone' | 'bio' | 'hourlyRate' | 'address' | 'apartment' | 'city' | 'zipCode'
    >
  >
): Promise<AuthResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { user: null, error: 'Not authenticated' };
  }

  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.hourlyRate !== undefined)
    dbUpdates.hourly_rate = updates.hourlyRate;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.apartment !== undefined) dbUpdates.apartment = updates.apartment;
  if (updates.city !== undefined) dbUpdates.city = updates.city;
  if (updates.zipCode !== undefined) dbUpdates.zip_code = updates.zipCode;

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', session.user.id)
    .select('*')
    .single();

  if (error || !profile) {
    logger.error('[auth:updateProfile] update failed', { code: (error as any)?.status });
    return { user: null, error: error?.message ?? 'Update failed' };
  }

  logger.info('[auth:updateProfile] profile updated');
  return { user: mapToUser(profile), error: null };
}

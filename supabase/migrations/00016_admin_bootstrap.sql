-- ============================================================================
-- ServiceHub Pro — Company administrator bootstrap (ADDITIVE)
-- ============================================================================
-- Creates the dedicated admin account used to log into the Admin Console
-- (admin-dashboard/). The console is ADMIN-ONLY: technicians and customers are
-- refused at the app gate (see admin-dashboard/src/App.tsx) and by RLS.
--
-- This migration:
--   1. Expands the profiles.role CHECK to allow 'admin' (non-breaking).
--   2. Creates admin@servicehub.test with a confirmed email + is_admin = true.
--   3. Reloads the PostgREST schema cache.
--
-- Run AFTER 00015_admin_rls.sql (which adds the is_admin column + policies).
-- Idempotent and safe to re-run.
--
-- Apply in the Supabase SQL Editor (or `supabase db push`), then sign in with:
--     email:    admin@servicehub.test
--     password: Admin@2026!
-- CHANGE THIS PASSWORD before any production / shared deployment.
-- ============================================================================

-- 1. Allow the 'admin' role (expands the existing constraint, does not drop data).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'technician', 'admin'));

-- 2. Idempotent seed of the admin account.
CREATE OR REPLACE FUNCTION public.seed_admin_account(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT
)
RETURNS void AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Idempotent: newer Supabase has NO single-column unique constraint on
    -- auth.users.email (it uses a partial unique index on email WHERE
    -- instance_id IS NULL), so ON CONFLICT (email) is invalid. Check existence
    -- explicitly and only insert when the account does not yet exist.
    SELECT u.id INTO v_user_id FROM auth.users u WHERE u.email = p_email LIMIT 1;
    IF v_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token_new,
            email_change, email_change_sent_at, last_sign_in_at,
            phone, phone_confirmed_at,         phone_change, phone_change_token,
            phone_change_sent_at, banned_until,
            reauthentication_token, reauthentication_sent_at, is_super_admin, is_sso_user
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            p_email,
            crypt(p_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('name', p_name, 'role', 'admin'),
            NOW(), NOW(),
            '', NOW(),
            '', NOW(),
            '', '',
            NOW(), NOW(),
            NULL, NULL,
            '', '',
            NOW(),
            NULL, '', NOW(),
            false, false
        )
        RETURNING id INTO v_user_id;
    END IF;

    -- The handle_new_user() trigger likely already created the profile; upsert
    -- to guarantee role = 'admin' and is_admin = true.
    INSERT INTO public.profiles (id, email, name, role, is_admin)
    VALUES (v_user_id, p_email, p_name, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        is_admin = true,
        name = EXCLUDED.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT public.seed_admin_account('admin@servicehub.test', 'Admin@2026!', 'ServiceHub Admin');

-- Clean up the helper so it is not left in the schema.
DROP FUNCTION IF EXISTS public.seed_admin_account(TEXT, TEXT, TEXT);

-- 3. Reload PostgREST schema cache so the new role value + policies are picked up.
NOTIFY pgrst, 'reload schema';

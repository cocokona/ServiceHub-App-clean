-- ============================================================================
-- ServiceHub Pro — Dev seed: repair / electrical / beauty provider accounts
-- ============================================================================
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- Creates 3 technician accounts with fake, non-deliverable emails and email
-- already confirmed (no verification email is sent). Safe to re-run.
--
--   Password for all three: test1234
--   Emails:  repair@servicehub.test
--            electrical@servicehub.test
--            beauty@servicehub.test
--
-- These map to:  role = 'technician'  (NOT 'customer')
--                work_category = 'repair' | 'electrical' | 'beauty'
--
-- NOTE: your existing 00005 migration already seeds maria@repair.test,
-- jake@electrical.test, luna@beauty.test. This migration adds cleanly-named
-- accounts. Delete 0005's rows if you only want these.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_provider_account(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_work_category TEXT
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
            jsonb_build_object('name', p_name, 'role', 'technician', 'work_category', p_work_category),
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

    -- The handle_new_user() trigger likely already created the profile;
    -- upsert to guarantee role + work_category are correct.
    INSERT INTO public.profiles (id, email, name, role, work_category)
    VALUES (v_user_id, p_email, p_name, 'technician', p_work_category)
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        work_category = EXCLUDED.work_category,
        name = EXCLUDED.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1) Repair technician
SELECT public.seed_provider_account('repair@servicehub.test',    'test1234', 'Repair Tech',    'repair');

-- 2) Electrical technician
SELECT public.seed_provider_account('electrical@servicehub.test', 'test1234', 'Electrical Tech', 'electrical');

-- 3) Beauty technician
SELECT public.seed_provider_account('beauty@servicehub.test',     'test1234', 'Beauty Tech',     'beauty');

-- Clean up the helper so it is not left in the schema.
DROP FUNCTION IF EXISTS public.seed_provider_account(TEXT, TEXT, TEXT, TEXT);

-- Verify:
-- SELECT u.email, p.name, p.role, p.work_category
-- FROM auth.users u JOIN public.profiles p ON p.id = u.id
-- WHERE u.email LIKE '%@servicehub.test' ORDER BY u.email;

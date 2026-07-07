-- ============================================================================
-- ServiceHub Pro — Seed Test Technician Accounts
-- ============================================================================
-- Run this in the Supabase SQL Editor (step by step).
-- Password for all accounts: test1234
-- ============================================================================

-- STEP 1: Create a helper function that safely inserts a confirmed user.
-- This function runs as SECURITY DEFINER so it can write to auth.users.

CREATE OR REPLACE FUNCTION public.create_test_user(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT,
    p_work_category TEXT,
    p_phone TEXT,
    p_bio TEXT,
    p_hourly_rate NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Insert into auth.users with email already confirmed
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new,
        email_change, email_change_sent_at, last_sign_in_at,
        phone, phone_confirmed_at, phone_change, phone_change_token,
        phone_change_sent_at, confirmed_at, banned_until,
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
        jsonb_build_object('name', p_name, 'role', p_role, 'work_category', p_work_category),
        NOW(), NOW(),
        '', NOW(), '', NOW(), '', '', NOW(), NOW(),
        NULL, NULL, '', '', NOW(), NOW(), NULL, '', NOW(), false, false
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_user_id;

    -- If user already existed, look them up
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    END IF;

    -- Insert profile (trigger may have done this already)
    INSERT INTO public.profiles (id, email, name, role, work_category, phone, bio, hourly_rate)
    VALUES (v_user_id, p_email, p_name, p_role, p_work_category, p_phone, p_bio, p_hourly_rate)
    ON CONFLICT (id) DO UPDATE SET
        phone = EXCLUDED.phone,
        bio = EXCLUDED.bio,
        hourly_rate = EXCLUDED.hourly_rate;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Run this to create all 4 technician accounts.
-- After running, you can delete this function if you want.

SELECT public.create_test_user(
    'alex@cleaning.test', 'test1234', 'Alex Cleaner', 'technician', 'cleaning',
    '555-0101', 'Professional deep cleaning specialist with 5+ years experience.', 45.00
);

SELECT public.create_test_user(
    'maria@repair.test', 'test1234', 'Maria Fixer', 'technician', 'repair',
    '555-0102', 'Licensed handyman covering plumbing, carpentry, and general repairs.', 65.00
);

SELECT public.create_test_user(
    'jake@electrical.test', 'test1234', 'Jake Sparky', 'technician', 'electrical',
    '555-0103', 'Certified electrician for residential and commercial work.', 85.00
);

SELECT public.create_test_user(
    'luna@beauty.test', 'test1234', 'Luna Beauty', 'technician', 'beauty',
    '555-0104', 'Licensed cosmetologist specializing in at-home beauty services.', 55.00
);

-- STEP 3 (optional): Clean up the helper function after use
-- DROP FUNCTION IF EXISTS public.create_test_user(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC);

-- STEP 4 (optional): Verify the accounts
-- SELECT u.email, p.name, p.role, p.work_category, p.hourly_rate
-- FROM auth.users u
-- JOIN public.profiles p ON p.id = u.id
-- WHERE u.email LIKE '%@%.test'
-- ORDER BY u.email;

-- ============================================================================
-- 00006_backfill_profiles.sql
-- ----------------------------------------------------------------------------
-- Root cause of the "Your profile was not found. Please sign out and sign in
-- again." checkout error:
--
--   The order_in_progress / jobs / messages tables have a foreign key to
--   profiles(id). Accounts created BEFORE the on_auth_user_created trigger
--   existed (or whose profile row was lost) have no profiles entry, so any
--   write fails with a 23503 FK violation.
--
-- The app now self-heals at runtime via ensureProfile(), but this migration
-- repairs the data layer for EVERY existing account so the gap cannot recur
-- and historical analytics / RLS are consistent.
-- ============================================================================

-- Insert a profiles row for every auth.users that does not already have one.
-- Runs with elevated (table-owner) privileges, so RLS is bypassed.
INSERT INTO public.profiles (id, email, name, role, work_category, created_at, updated_at)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    CASE
        WHEN u.raw_user_meta_data->>'role' = 'technician' THEN 'technician'
        ELSE 'customer'
    END,
    CASE
        WHEN u.raw_user_meta_data->>'work_category'
             IN ('cleaning', 'repair', 'electrical', 'beauty', 'all')
        THEN u.raw_user_meta_data->>'work_category'
        ELSE NULL
    END,
    NOW(),
    NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL;

-- Ensure the signup trigger is present (idempotent) so future accounts always
-- get a profile, even if the trigger was dropped at some point.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, work_category)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        CASE
            WHEN NEW.raw_user_meta_data->>'role' = 'technician' THEN 'technician'
            ELSE 'customer'
        END,
        CASE
            WHEN NEW.raw_user_meta_data->>'work_category'
                 IN ('cleaning', 'repair', 'electrical', 'beauty', 'all')
            THEN NEW.raw_user_meta_data->>'work_category'
            ELSE NULL
        END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Refresh the PostgREST schema cache so the new rows/policies are live.
NOTIFY pgrst, 'reload schema';

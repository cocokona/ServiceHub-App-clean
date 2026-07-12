-- ============================================================================
-- ServiceHub Pro — Optional RBAC helper
-- ============================================================================
-- Adds a DB-level `current_role()` function you can use inside Row Level
-- Security policies to branch on the caller's role (customer vs technician)
-- or work_category. Read-only, SECURITY DEFINER so it works inside RLS
-- (which executes as the invoking user, not the policy owner).
--
-- This does NOT change any existing policy — it only exposes the helper.
-- Example usage in a future policy:
--
--   CREATE POLICY "technicians_read_all_profiles"
--     ON public.profiles FOR SELECT
--     TO authenticated
--     USING (public.current_role() = 'technician' OR id = auth.uid());
--
--   -- or restrict by category:
--   -- USING (public.current_role() = 'technician'
--   --        AND work_category = public.current_work_category());
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_work_category()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT work_category FROM public.profiles WHERE id = auth.uid();
$$;

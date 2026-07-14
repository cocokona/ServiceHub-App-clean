-- ============================================================================
-- ServiceHub Pro — Admin read/write access (ADDITIVE, non-breaking)
-- ============================================================================
-- The admin dashboard (admin-dashboard/) authenticates real users via
-- Supabase Auth and uses the PUBLIC anon key in the browser. All access stays
-- inside Row Level Security — we NEVER embed the service_role key client-side.
--
-- This migration grants logged-in ADMIN users (profiles.is_admin = true) broad
-- read (and the necessary write) access so the dashboard can show platform-wide
-- data: all jobs, messages, payments, profiles, etc.
--
-- It is purely additive: it adds one column + helper + policies. No existing
-- table, policy, or data is modified or dropped.
--
-- Apply with:  supabase db push   (or paste into the Supabase SQL Editor)
-- Then promote an account to admin:
--     UPDATE public.profiles SET is_admin = true WHERE email = 'you@servicehub.io';
-- ============================================================================

-- 1. Flag column (defaults to false → existing users are unaffected)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. SECURITY DEFINER helper so RLS can branch on the caller's admin flag.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. Admin SELECT policies (OR'd with existing per-user policies)
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "jobs_select_admin" ON public.jobs;
CREATE POLICY "jobs_select_admin" ON public.jobs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "oip_select_admin" ON public.order_in_progress;
CREATE POLICY "oip_select_admin" ON public.order_in_progress
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "messages_select_admin" ON public.messages;
CREATE POLICY "messages_select_admin" ON public.messages
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "messages_insert_admin" ON public.messages;
CREATE POLICY "messages_insert_admin" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "messages_update_admin" ON public.messages;
CREATE POLICY "messages_update_admin" ON public.messages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "reviews_select_admin" ON public.reviews;
CREATE POLICY "reviews_select_admin" ON public.reviews
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "availability_select_admin" ON public.technician_availability;
CREATE POLICY "availability_select_admin" ON public.technician_availability
  FOR SELECT TO authenticated USING (public.is_admin());

-- Reload PostgREST schema cache so the new column/policies are picked up.
NOTIFY pgrst, 'reload schema';

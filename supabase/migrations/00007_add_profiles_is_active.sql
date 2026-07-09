-- ============================================================================
-- 00007_add_profiles_is_active.sql
-- ----------------------------------------------------------------------------
-- Supports the customer "Select Technician" feature: only ACTIVE technicians
-- should be selectable when a customer assigns a technician to an order.
--
-- Until now the marketplace listed every non-deleted technician
-- (role = 'technician' AND deleted_at IS NULL). There was no way to hide a
-- technician whose account an admin had deactivated (but not soft-deleted).
--
-- This adds an explicit `is_active` flag (default true) so deactivated
-- technicians are filtered out at the query level in fetchTechnicians().
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS
  'Account activation flag. Inactive technicians are hidden from the customer-facing "Select Technician" list.';

-- Partial index: fast lookup of active, non-deleted technicians.
-- Mirrors the exact filter used by fetchTechnicians().
CREATE INDEX IF NOT EXISTS idx_profiles_active_technicians
  ON public.profiles (role, work_category)
  WHERE role = 'technician'
    AND is_active = true
    AND deleted_at IS NULL;

-- Existing seed/backfilled technician rows default to is_active = true, so no
-- data update is required — they remain selectable unless an admin deactivates
-- them.

-- ----------------------------------------------------------------------------
-- CRITICAL: Notify PostgREST to reload its schema cache so the new column is
-- recognized by the Supabase JS client. Without this the REST API would throw
-- "Could not find the ... is_active" / column-not-found errors.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

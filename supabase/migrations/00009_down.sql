-- ============================================================================
-- ServiceHub Pro — rollback for 00009_technician_locations
-- ============================================================================
-- Locations are ephemeral and referenced by NO other table (the FKs point
-- *from* this table *to* jobs/profiles, never the reverse), so a plain
-- DROP TABLE is safe with no dependent objects. Idempotent + re-runnable.

DROP POLICY IF EXISTS "tech_loc_insert_technician" ON public.technician_locations;
DROP POLICY IF EXISTS "tech_loc_select_participants" ON public.technician_locations;
DROP TABLE IF EXISTS public.technician_locations;  -- cascades indexes
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ServiceHub Pro — Phone number uniqueness within each role group
-- ============================================================================
-- RULE: no two profiles of the SAME role may share a phone number, but a
-- customer and a technician are allowed to have the same number. Uniqueness is
-- therefore enforced PER ROLE GROUP via two PARTIAL UNIQUE indexes on
-- profiles.phone:
--   - one scoped to role = 'customer'
--   - one scoped to role = 'technician'
--
-- DESIGN NOTES:
--   * Empty / NULL phones are EXCLUDED from the constraint (a user may simply
--     have no phone on file). The app normalizes phone input by trimming, and
--     treats whitespace-only input as "no phone" — so it never reaches here.
--   * Cross-role overlap is permitted by design: the two indexes are
--     independent, so a customer and a technician can both register "555-0101".
--   * The DB is the authoritative backstop. The app also performs a friendly
--     pre-check (src/services/phone.service.ts) so the UI can reject a
--     duplicate before the network write and show a clear message instead of a
--     raw constraint error.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Safety guard: refuse to apply if duplicate phones already exist per role.
--    A UNIQUE index cannot be created on data that already violates it; rather
--    than fail mid-migration with an opaque error, surface the offenders.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_role  text;
  v_phone text;
  v_cnt   int;
  v_found boolean := false;
BEGIN
  FOR v_role, v_phone, v_cnt IN
    SELECT role, phone, count(*)
    FROM public.profiles
    WHERE deleted_at IS NULL
      AND phone IS NOT NULL
      AND phone <> ''
    GROUP BY role, phone
    HAVING count(*) > 1
  LOOP
    v_found := true;
    RAISE NOTICE 'DUPLICATE phone within role "%": "%" appears % times',
      v_role, v_phone, v_cnt;
  END LOOP;

  IF v_found THEN
    RAISE EXCEPTION
      'Cannot create per-role phone uniqueness: duplicate phone numbers exist '
      'within a role. Resolve the duplicates listed above (keep exactly one '
      'profile per phone per role) and re-run this migration.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Partial unique indexes — one per role group
-- ----------------------------------------------------------------------------

-- Customers: each active customer must have a distinct, non-empty phone.
DROP INDEX IF EXISTS public.idx_profiles_customer_phone_unique;
CREATE UNIQUE INDEX idx_profiles_customer_phone_unique
    ON public.profiles (phone)
    WHERE role = 'customer'
      AND deleted_at IS NULL
      AND phone IS NOT NULL
      AND phone <> '';

-- Technicians: each active technician must have a distinct, non-empty phone.
DROP INDEX IF EXISTS public.idx_profiles_technician_phone_unique;
CREATE UNIQUE INDEX idx_profiles_technician_phone_unique
    ON public.profiles (phone)
    WHERE role = 'technician'
      AND deleted_at IS NULL
      AND phone IS NOT NULL
      AND phone <> '';

-- ----------------------------------------------------------------------------
-- 2. Refresh the PostgREST schema cache so the new constraint is visible to
--    the REST/client layer immediately.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

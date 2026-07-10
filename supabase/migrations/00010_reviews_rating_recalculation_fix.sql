-- ============================================================================
-- ServiceHub Pro — Harden technician rating recalculation
-- ============================================================================
-- The trigger installed by 00001 (trg_reviews_update_rating →
-- recalculate_technician_rating) recomputes a technician's average rating and
-- review count whenever a review is inserted/updated. However it only ever
-- read NEW.technician_id. On a DELETE, NEW is NULL in PostgreSQL, so the
-- UPDATE matched no profile and the technician's rating went STALE.
--
-- This migration replaces the function with a robust version that:
--   - uses OLD.technician_id on DELETE,
--   - recomputes the new technician on INSERT/UPDATE,
--   - recomputes the former technician too when a review is reassigned.
--
-- A helper (recompute_tech_rating) is extracted so both branches stay DRY.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_tech_rating(p_tech_id UUID)
RETURNS void AS $$
BEGIN
  IF p_tech_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    rating = (
      SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,1)
      FROM public.reviews
      WHERE technician_id = p_tech_id
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE technician_id = p_tech_id
    )
  WHERE id = p_tech_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.recalculate_technician_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_new_tech UUID := NEW.technician_id;
  v_old_tech UUID := OLD.technician_id;
BEGIN
  -- DELETE: only OLD is available.
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_tech_rating(v_old_tech);
    RETURN NULL;
  END IF;

  -- INSERT / UPDATE: recompute the (current) technician.
  PERFORM public.recompute_tech_rating(v_new_tech);

  -- UPDATE with a reassigned technician: also fix the previous owner so its
  -- aggregate does not keep a phantom review.
  IF TG_OP = 'UPDATE' AND v_old_tech IS DISTINCT FROM v_new_tech THEN
    PERFORM public.recompute_tech_rating(v_old_tech);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger still references recalculate_technician_rating by name; since we
-- replaced the function in place (same signature → same OID), no recreation is
-- required. We recreate it defensively to guarantee a clean binding.
DROP TRIGGER IF EXISTS trg_reviews_update_rating ON public.reviews;
CREATE TRIGGER trg_reviews_update_rating
    AFTER INSERT OR DELETE OR UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_technician_rating();

-- ----------------------------------------------------------------------------
-- Helpful index for the "top review" query (highest-rated text review).
-- Backs the customer-facing recommended-technician section efficiently.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_tech_rating_text
    ON public.reviews (technician_id, rating DESC, created_at DESC)
    WHERE comment IS NOT NULL AND comment <> '';

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the auto-generated
-- REST API immediately recognizes the new helper function and index.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

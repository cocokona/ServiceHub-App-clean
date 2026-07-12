-- ============================================================================
-- ServiceHub Pro — Reconcile order_in_progress_time_slot_check constraint
-- ============================================================================
-- INVESTIGATION
-- --------------
-- Inserting certain orders failed with:
--   new row for relation 'order_in_progress' violates check constraint
--   'order_in_progress_time_slot_check'
--
-- The constraint `order_in_progress_time_slot_check` is the auto-named inline
-- CHECK on `time_slot` (Postgres names it <table>_<column>_check). Its ONLY
-- job is to guarantee `time_slot` holds a valid scheduling window:
--
--     time_slot IN ('morning', 'afternoon', 'evening')
--
-- The constraint itself is CORRECT and must stay. The actual failure was
-- caused by the application sending an out-of-set value ('afterning', a typo
-- for 'afternoon' in the time-slot config) which the constraint rightly
-- rejected. Cleaning work (standalone or as part of a repair order) is valid
-- and is in no way restricted by this constraint — it was simply being fed an
-- invalid slot value.
--
-- This migration makes the constraint definition explicit and canonical so the
-- deployed schema cannot silently drift into an over-restrictive variant, and
-- documents that service category (including 'cleaning') is intentionally NOT
-- coupled to the time slot. Data integrity is preserved: only the three real
-- scheduling windows are accepted.
--
-- Idempotent + safe to re-run.
-- ============================================================================

-- Drop whatever variant currently exists (correct, drifted, or stricter).
ALTER TABLE public.order_in_progress
  DROP CONSTRAINT IF EXISTS order_in_progress_time_slot_check;

-- Re-create the canonical, category-agnostic check. Cleaning (and any other
-- service category) remains permitted; only the time-slot value is validated.
ALTER TABLE public.order_in_progress
  ADD CONSTRAINT order_in_progress_time_slot_check
  CHECK (time_slot IN ('morning', 'afternoon', 'evening'));

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the new/changed
-- constraint is picked up by the auto-generated REST API.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

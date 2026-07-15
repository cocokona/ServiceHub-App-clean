-- ============================================================================
-- REMEDIATION: reload PostgREST schema cache for `local_tz`
-- ============================================================================
-- Symptom (client / Expo console):
--   Error: Could not find the 'local_tz' column of 'order_in_progress'
--          in the schema cache
--   thrown from createOrderInProgress() during Checkout.
--
-- Root cause:
--   Migration 00019 adds `local_tz` (and the jobs audit columns) and ends with
--   `NOTIFY pgrst, 'reload schema';`. If that migration was applied before the
--   NOTIFY took effect (or the notify was missed), the column EXISTS in
--   Postgres but PostgREST's cached introspection of `order_in_progress` is
--   stale — so the JS client's insert is rejected even though the DB is fine.
--
-- What this script does (ALL idempotent — safe to run repeatedly):
--   1. Ensures the `local_tz` column (and jobs audit columns) exist.
--   2. Re-creates the auto_cancel_unaccepted_orders() function + pg_cron job.
--   3. Reloads the PostgREST schema cache so the client can see `local_tz`.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this entire file → "Run".
--   No downtime; the NOTIFY at the end refreshes the cache instantly.
-- ============================================================================

-- 1) Guarantee the columns exist (no-op if already present).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cancelled_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS local_tz TEXT;

ALTER TABLE public.order_in_progress
  ADD COLUMN IF NOT EXISTS local_tz TEXT;

-- 2) Re-create the auto-cancel function (idempotent).
CREATE OR REPLACE FUNCTION public.auto_cancel_unaccepted_orders()
RETURNS INTEGER AS $$
DECLARE
  v_timeout   INTERVAL := INTERVAL '30 minutes';
  v_count     INTEGER := 0;
  v_deleted   INTEGER;
BEGIN
  LOOP
    WITH candidate AS (
      SELECT oip.*
      FROM public.order_in_progress oip
      WHERE oip.technician_id IS NULL
        AND oip.scheduled_date = (oip.created_at AT TIME ZONE COALESCE(oip.local_tz, 'UTC'))::date
        AND oip.created_at + v_timeout <= NOW()
      ORDER BY oip.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ),
    deleted AS (
      DELETE FROM public.order_in_progress oip
      USING candidate
      WHERE oip.id = candidate.id
      RETURNING candidate.*
    )
    INSERT INTO public.jobs (
      service_type, service_category,
      customer_id, customer_name, customer_phone, customer_avatar,
      address, apartment, city, zip_code,
      scheduled_date, time_slot, rooms, duration, focus_areas, notes,
      status,
      base_rate, tax, travel_fee, add_ons_price, total_price,
      technician_id, technician_name, technician_avatar,
      cancelled_reason, cancelled_at, local_tz
    )
    SELECT
      service_type, service_category,
      customer_id, customer_name, customer_phone, customer_avatar,
      address, apartment, city, zip_code,
      scheduled_date, time_slot, rooms, duration, focus_areas, notes,
      'cancelled',
      base_rate, tax, travel_fee, add_ons_price, total_price,
      technician_id, technician_name, technician_avatar,
      'Auto-cancelled: no technician accepted the same-day order within 30 minutes.',
      NOW(),
      oip.local_tz
    FROM deleted;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted = 0;
    v_count := v_count + v_deleted;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) (Best-effort) (Re)schedule via pg_cron when available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'auto_cancel_unaccepted_orders'
    ) THEN
      PERFORM cron.schedule(
        'auto_cancel_unaccepted_orders',
        '* * * * *',
        'SELECT public.auto_cancel_unaccepted_orders();'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron is not installed — auto_cancel_unaccepted_orders() created but NOT scheduled. '
                'Enable pg_cron (Supabase Pro) or invoke supabase.rpc(''auto_cancel_unaccepted_orders'') '
                'from an Edge Function / server cron on a 1-minute cadence.';
  END IF;
END $$;

-- 4) THE FIX: reload PostgREST schema cache so the client sees `local_tz`.
NOTIFY pgrst, 'reload schema';

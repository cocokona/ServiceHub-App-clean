-- ============================================================================
-- ServiceHub Pro — Auto-cancel unaccepted same-day orders
-- ============================================================================
-- Problem: a customer books a service for TODAY (a same-day / urgent booking).
-- If no technician accepts it, the order should be automatically cancelled
-- after 30 minutes so the customer is not left hanging and the slot is freed.
--
-- Rules enforced by auto_cancel_unaccepted_orders():
--   1. Only acts on orders still waiting in `order_in_progress`
--      (technician_id IS NULL).
--   2. Only "same-day" orders are eligible: the scheduled date equals the
--      calendar date the order was CREATED on — evaluated in the DEVICE's
--      timezone (captured per order as `local_tz`), NOT UTC. This is anchored
--      to the creation instant — NOT the current date — so an order placed at
--      23:55 for "today" is STILL recognised as a same-day order after midnight
--      (the classic near-midnight edge case) and gets cancelled at its
--      30-minute deadline instead of being silently skipped. Using the device
--      timezone (rather than UTC) is what keeps the rule consistent with the
--      clock the customer actually sees on their phone.
--   3. The 30-minute acceptance window starts at order creation (created_at).
--      If an explicit assignment timestamp is introduced later, use
--      GREATEST(created_at, assigned_at) as the countdown anchor. The window
--      length is an absolute interval, so timezone does not affect it.
--   4. Future-dated orders (scheduled_date <> creation date in the device tz)
--      are NEVER auto-cancelled by this rule.
--   5. On timeout the pending order is MOVED into `jobs` with status
--      'cancelled' (mirroring accept_order_in_progress) so there is an
--      auditable record, then removed from `order_in_progress`.
--
-- Concurrency: each order is claimed atomically with
-- `FOR UPDATE SKIP LOCKED` + a single DELETE...RETURNING...INSERT statement,
-- so a concurrent technician accept (which deletes the same row) causes this
-- function to process zero rows for that order — no duplicate job, no race.
--
-- Scheduling: if pg_cron is available (Supabase Pro+), a job is created that
-- runs the function every minute. On tiers without pg_cron the function is
-- still created and can be invoked via `supabase.rpc(...)` from an Edge
-- Function or a server-side scheduler.
-- ============================================================================

-- Audit columns on jobs for cancellation traceability.
-- Nullable so existing rows keep their defaults untouched.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cancelled_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS local_tz TEXT;

-- Cheap scan for the auto-cancel sweep: only unassigned (and never deleted)
-- orders are relevant, ordered/filtered by created_at.
CREATE INDEX IF NOT EXISTS idx_oip_auto_cancel
  ON public.order_in_progress (created_at)
  WHERE technician_id IS NULL;

-- Device timezone captured at booking (IANA name, e.g. 'Asia/Shanghai'). This
-- is what makes the "same-day" check match the clock the customer sees on
-- their phone instead of UTC. Nullable + COALESCE('UTC') keeps legacy rows
-- working; new orders always populate it from the client.
ALTER TABLE public.order_in_progress
  ADD COLUMN IF NOT EXISTS local_tz TEXT;

-- ----------------------------------------------------------------------------
-- Function: auto_cancel_unaccepted_orders()
--   Returns the number of orders cancelled in this invocation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_cancel_unaccepted_orders()
RETURNS INTEGER AS $$
DECLARE
  v_timeout   INTERVAL := INTERVAL '30 minutes';
  v_count     INTEGER := 0;
  v_deleted   INTEGER;
BEGIN
  LOOP
    WITH candidate AS (
      -- Pick exactly one eligible, still-unassigned order and lock it so a
      -- concurrent run / accept cannot act on the same row.
      SELECT oip.*
      FROM public.order_in_progress oip
      WHERE oip.technician_id IS NULL
        -- Same-day eligibility: scheduled date == creation date in the
        -- DEVICE's timezone (captured per order), NOT UTC. Anchored to the
        -- creation instant so it never flips as the calendar rolls over. The
        -- COALESCE keeps legacy rows (no local_tz) on the old UTC behaviour.
        AND oip.scheduled_date = (oip.created_at AT TIME ZONE COALESCE(oip.local_tz, 'UTC'))::date
        -- 30-minute countdown from creation has elapsed.
        AND oip.created_at + v_timeout <= NOW()
      ORDER BY oip.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ),
    deleted AS (
      -- Atomically remove the claimed order.
      DELETE FROM public.order_in_progress oip
      USING candidate
      WHERE oip.id = candidate.id
      RETURNING candidate.*
    )
    -- Archive it as a terminal 'cancelled' job (auditable record).
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

-- ----------------------------------------------------------------------------
-- Scheduling (best-effort): enable pg_cron when present, otherwise notify.
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- CRITICAL: reload PostgREST schema cache so the new function and the new
-- jobs columns are visible to the Supabase JS client.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

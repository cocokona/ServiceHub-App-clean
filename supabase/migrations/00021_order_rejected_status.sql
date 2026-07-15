-- ============================================================================
-- ServiceHub Pro — Rejection is now a terminal order status
-- ============================================================================
-- Previously an order_in_progress had NO status column, so its status was
-- hardcoded to 'pending' client-side and a technician's decline only recorded
-- a reason while leaving the order "pending" forever. That meant a customer's
-- order page never reflected the rejection.
--
-- This migration introduces a real status on order_in_progress and makes a
-- rejection flip the order to 'rejected', so:
--   * the customer sees the order as REJECTED on their orders page, and
--   * the order leaves the technician browse pool (no longer 'pending').
-- The customer then chooses, via the app dialog, to either re-open the order
-- to the pool (status -> 'pending') or cancel it for a refund (status ->
-- 'cancelled').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. status column on order_in_progress
-- ----------------------------------------------------------------------------
-- Only three statuses ever live on an order_in_progress row:
--   'pending'   — awaiting a technician (browseable by technicians)
--   'rejected'  — a technician declined it; leaves the pool, awaits customer
--   'cancelled' — customer cancelled (e.g. for a refund); leaves the pool
-- Acceptance (the order moving to `jobs`) deletes the row, so 'confirmed' etc.
-- belong to the jobs table, not here.
ALTER TABLE public.order_in_progress
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rejected', 'cancelled'));

-- When the order was declined, record the timestamp (used by the app to show
-- "declined on …" if needed). Null until the first rejection.
ALTER TABLE public.order_in_progress
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- When the customer cancels for a refund, record the timestamp.
ALTER TABLE public.order_in_progress
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_oip_status
    ON public.order_in_progress (status);

-- ----------------------------------------------------------------------------
-- 2. reject_order_in_progress — now flips status to 'rejected'
-- ----------------------------------------------------------------------------
-- Previously this only set last_rejection_reason. It now also transitions the
-- order out of the browseable 'pending' state and stamps rejected_at, so the
-- customer's orders page and the technician pool both update correctly.
CREATE OR REPLACE FUNCTION public.reject_order_in_progress(
    p_order_id      UUID,
    p_technician_id UUID,
    p_reason        TEXT
)
RETURNS void AS $$
BEGIN
    -- Authorize: a technician can only record a decline on their own behalf.
    IF p_technician_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'reject_order_in_progress: caller is not the rejecting technician';
    END IF;

    -- Record (or update) the technician's decline for this order.
    INSERT INTO public.order_rejections (order_id, technician_id, reason)
    VALUES (p_order_id, p_technician_id, p_reason)
    ON CONFLICT (order_id, technician_id)
    DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW();

    -- Surface the most recent decline reason to the customer (who reads it
    -- from their own order_in_progress row) AND transition the order to the
    -- terminal 'rejected' state so it leaves the technician pool and shows up
    -- as REJECTED on the customer's orders page.
    UPDATE public.order_in_progress
    SET last_rejection_reason = p_reason,
        status = 'rejected',
        rejected_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. set_order_in_progress_status — customer-driven status change
-- ----------------------------------------------------------------------------
-- Invoked by the customer's rejection dialog:
--   * 'pending'   — re-open the order to the technician pool (request a
--                   different technician). Clears the stale rejection reason
--                   and timestamp so the order re-enters the pool cleanly.
--   * 'cancelled' — cancel the order (full refund). Stamps cancelled_at.
--
-- Security: only the order's OWNER (customer_id = auth.uid()) may call this,
-- preventing a technician or another customer from mutating someone's order.
CREATE OR REPLACE FUNCTION public.set_order_in_progress_status(
    p_order_id UUID,
    p_status   TEXT
)
RETURNS void AS $$
BEGIN
    IF p_status NOT IN ('pending', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION 'set_order_in_progress_status: invalid status %', p_status;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.order_in_progress
        WHERE id = p_order_id AND customer_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'set_order_in_progress_status: not authorized for this order';
    END IF;

    IF p_status = 'pending' THEN
        -- Re-open to the pool: clear the previous decline so it doesn't
        -- surface as "rejected" again and the rejecting technician stays
        -- excluded via their own order_rejections row.
        UPDATE public.order_in_progress
        SET status = 'pending',
            last_rejection_reason = NULL,
            rejected_at = NULL,
            cancelled_at = NULL,
            updated_at = NOW()
        WHERE id = p_order_id;
    ELSIF p_status = 'cancelled' THEN
        UPDATE public.order_in_progress
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = p_order_id;
    ELSE
        -- Defensive: 'rejected' should only come from reject_order_in_progress,
        -- but allow an explicit set for completeness.
        UPDATE public.order_in_progress
        SET status = 'rejected',
            rejected_at = NOW(),
            updated_at = NOW()
        WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the new column and
-- RPCs are visible to the Supabase JS client.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

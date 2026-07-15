-- ============================================================================
-- ServiceHub Pro — Availability default + Order rejection system
-- ============================================================================
-- 1. Technician availability now starts CLOSED by default. A technician must
--    manually open each slot; that change is persisted via the existing
--    setTechnicianAvailability() upsert. The DB default flips from true -> false
--    so any newly-created availability row (e.g. seeded slots) is closed.
-- 2. Order rejection: a technician can decline an order_in_progress with a
--    predefined reason. The rejection is recorded per (technician, order) and
--    the most recent reason is surfaced to the customer on their own order row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Availability starts CLOSED by default
-- ----------------------------------------------------------------------------
-- Pre-2026-07-14 the column defaulted to true, which meant a technician's
-- weekly slots were "open" until they proactively closed them. The product now
-- requires the opposite: every slot is closed until the technician opts in.
ALTER TABLE public.technician_availability
    ALTER COLUMN is_available SET DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. order_rejections — audit of technician declines
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_rejections (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id      UUID NOT NULL REFERENCES public.order_in_progress(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason        TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- A technician may only reject a given order once; re-submitting simply
-- updates the reason. This also prevents the same decline from stacking.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_rejections_unique
    ON public.order_rejections (order_id, technician_id);

CREATE INDEX IF NOT EXISTS idx_order_rejections_order
    ON public.order_rejections (order_id);

CREATE INDEX IF NOT EXISTS idx_order_rejections_technician
    ON public.order_rejections (technician_id);

-- ----------------------------------------------------------------------------
-- 3. last_rejection_reason on order_in_progress — customer-facing notice
-- ----------------------------------------------------------------------------
-- The customer reads this from their OWN order row (RLS: customer_id =
-- auth.uid()), so we never expose which technician declined (privacy). The
-- order_rejections table stays technician-only.
ALTER TABLE public.order_in_progress
    ADD COLUMN IF NOT EXISTS last_rejection_reason TEXT;

-- ----------------------------------------------------------------------------
-- 4. RLS for order_rejections
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

-- Technicians may record a decline only on their own behalf.
CREATE POLICY "or_insert_self"
    ON public.order_rejections FOR INSERT
    TO authenticated
    WITH CHECK (technician_id = auth.uid());

-- Technicians may read their own rejections (used to hide them from the list).
CREATE POLICY "or_select_self"
    ON public.order_rejections FOR SELECT
    TO authenticated
    USING (technician_id = auth.uid());

-- NOTE: No customer SELECT policy. Customers receive the (anonymous) reason
-- via order_in_progress.last_rejection_reason, never the technician's identity.

-- ----------------------------------------------------------------------------
-- 5. reject_order_in_progress(p_order_id, p_technician_id, p_reason)
-- ----------------------------------------------------------------------------
-- Records the decline and surfaces the reason to the customer. The order stays
-- in order_in_progress so other technicians can still pick it up (marketplace
-- model) — only the rejecting technician stops seeing it (enforced client-side
-- via fetchAllOrdersInProgress + their own rejection rows).
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

    -- Surface the most recent decline reason to the customer, who reads it
    -- from their own order_in_progress row.
    UPDATE public.order_in_progress
    SET last_rejection_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 6. seed_technician_availability(p_technician_id)
-- ----------------------------------------------------------------------------
-- Creates a full 7-day x 3-slot grid of CLOSED availability for a technician
-- who has no availability rows yet. Guarantees the "all slots start closed"
-- invariant at the data level and gives the Schedule tab a complete grid to
-- toggle. Idempotent: existing rows are never overwritten.
CREATE OR REPLACE FUNCTION public.seed_technician_availability(
    p_technician_id UUID
)
RETURNS void AS $$
BEGIN
    IF p_technician_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'seed_technician_availability: caller can only seed their own availability';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.technician_availability
        WHERE technician_id = p_technician_id
    ) THEN
        INSERT INTO public.technician_availability (technician_id, day_of_week, time_slot, is_available)
        SELECT p_technician_id, d, s, false
        FROM generate_series(0, 6) AS d
        CROSS JOIN (VALUES ('morning'), ('afternoon'), ('evening')) AS t(s);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the new table,
-- column, and RPC are visible to the Supabase JS client.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

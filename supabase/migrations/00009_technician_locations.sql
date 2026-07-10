-- ============================================================================
-- ServiceHub Pro — technician_locations (live tracking history)
-- ============================================================================
-- One INSERT per poll (append-only). The technician app streams a GPS ping
-- roughly every 60s while traveling to the customer; the customer app
-- subscribes to these inserts via Supabase Realtime and renders a live marker
-- + distance/ETA. No map SDK, no routing API, no API key required.
--
-- Style mirrors 00001 (messages/job_materials RLS) and 00004 (RLS +
-- trailing NOTIFY pgrst).

CREATE TABLE IF NOT EXISTS public.technician_locations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id        UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    heading       DOUBLE PRECISION,                -- degrees 0..360, nullable
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer subscribes ordered by newest-first; mirror idx_messages_job_id.
CREATE INDEX IF NOT EXISTS idx_tech_loc_job_recorded
    ON public.technician_locations (job_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_tech_loc_technician
    ON public.technician_locations (technician_id);

-- ----------------------------------------------------------------------------
-- RLS — keyed by auth.uid(). Participants (customer OR assigned technician)
-- may read; only the assigned technician may write their own rows.
-- ----------------------------------------------------------------------------
ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

-- Customers and the assigned technician can read the location history.
CREATE POLICY "tech_loc_select_participants"
    ON public.technician_locations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

-- Only the assigned technician may write their own location rows.
CREATE POLICY "tech_loc_insert_technician"
    ON public.technician_locations FOR INSERT
    TO authenticated
    WITH CHECK (
        technician_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND j.technician_id = auth.uid()
        )
    );

-- No UPDATE/DELETE policies — the table is append-only, which keeps the
-- write surface minimal and matches the "one INSERT per poll" design.

-- Notify PostgREST so the Supabase JS client sees technician_locations
-- (same rationale as 00004 line 169).
NOTIFY pgrst, 'reload schema';

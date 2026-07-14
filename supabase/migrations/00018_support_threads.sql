-- ============================================================================
-- 00018_support_threads.sql
-- ----------------------------------------------------------------------------
-- Purpose: enable a GENERAL customer-service chat that is NOT tied to a job.
--
-- Background:
--   The `messages` table (00001) requires `job_id UUID NOT NULL REFERENCES
--   jobs`. That works for job-specific chats (the app already opens SupportChat
--   from Tracking / JobDetails), but the profile pages need a "contact support"
--   button that opens a chat with no associated job. This migration introduces
--   `support_threads` and makes `messages` able to belong to EITHER a job OR a
--   support thread, so both flows land in the same admin console inbox.
--
-- Effects:
--   - New table `support_threads` (one row per user-opened support conversation).
--   - `messages.job_id` becomes nullable; new nullable `support_thread_id` FK.
--   - A CHECK guarantees every message targets exactly one of job / thread.
--   - RLS: thread owners + admins can read/write; admins can read/write all.
--   - Both tables added to supabase_realtime so mobile + admin get live updates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. support_threads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_threads (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_role  TEXT NOT NULL CHECK (user_role IN ('customer', 'technician')),
    subject    TEXT,
    status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_threads_user
    ON public.support_threads (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_status
    ON public.support_threads (status, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Make `messages` flexible: nullable job_id + support_thread_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS support_thread_id UUID
    REFERENCES public.support_threads(id) ON DELETE CASCADE;

-- Every message must target exactly one conversation (job XOR support thread).
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_target_check;
ALTER TABLE public.messages
    ADD CONSTRAINT messages_target_check
    CHECK ( (job_id IS NOT NULL) OR (support_thread_id IS NOT NULL) );

CREATE INDEX IF NOT EXISTS idx_messages_thread
    ON public.messages (support_thread_id, created_at);

-- ----------------------------------------------------------------------------
-- 3. Keep support_threads.updated_at fresh when a message arrives
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_support_thread()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.support_thread_id IS NOT NULL THEN
        UPDATE public.support_threads
           SET updated_at = now()
         WHERE id = NEW.support_thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_touch_support_thread ON public.messages;
CREATE TRIGGER trg_touch_support_thread
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.touch_support_thread();

-- ----------------------------------------------------------------------------
-- 4. RLS — support_threads
-- ----------------------------------------------------------------------------
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_threads_select_owner_or_admin"
    ON public.support_threads;
CREATE POLICY "support_threads_select_owner_or_admin"
    ON public.support_threads FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "support_threads_insert_owner"
    ON public.support_threads;
CREATE POLICY "support_threads_insert_owner"
    ON public.support_threads FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_threads_update_owner_or_admin"
    ON public.support_threads;
CREATE POLICY "support_threads_update_owner_or_admin"
    ON public.support_threads FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. RLS — extend `messages` to cover support threads
--    (admin policies from 00015 already cover is_admin(); we keep them and
--     widen the participant policies to include owned support threads.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants"
    ON public.messages FOR SELECT TO authenticated
    USING (
        (
            job_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.jobs j
                WHERE j.id = job_id
                  AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
            )
        )
        OR (
            support_thread_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.support_threads st
                WHERE st.id = support_thread_id
                  AND (st.user_id = auth.uid() OR public.is_admin())
            )
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_participants"
    ON public.messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND (
            (
                job_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.jobs j
                    WHERE j.id = job_id
                      AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
                )
            )
            OR (
                support_thread_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.support_threads st
                    WHERE st.id = support_thread_id
                      AND st.user_id = auth.uid()
                )
            )
        )
    );

-- ----------------------------------------------------------------------------
-- 6. Realtime — surface both tables to the admin + mobile clients
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'support_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
    END IF;
END $$;

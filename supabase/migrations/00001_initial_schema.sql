-- ============================================================================
-- ServiceHub Pro — Initial Database Schema
-- ============================================================================
-- This migration creates the complete normalized schema with:
--   - profiles table (linked to Supabase auth.users)
--   - services, jobs, job_checklists, job_materials
--   - messages, payments, reviews, technician_availability
--   - Row Level Security (RLS) policies on every table
--   - Performance indexes
--   - Auto-profile-creation trigger on signup
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. profiles  (extends Supabase auth.users — NOT a standalone users table)
-- ----------------------------------------------------------------------------
-- SECURITY: We never store passwords here. Supabase Auth handles passwords
-- with bcrypt hashing internally. This table holds application-level profile
-- data and is linked 1:1 to auth.users via the id column.
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'technician')),
    work_category VARCHAR(30)  CHECK (work_category IN ('cleaning', 'repair', 'electrical', 'beauty', 'all') OR work_category IS NULL),
    phone         VARCHAR(30),
    bio           TEXT,
    avatar_url    TEXT,
    hourly_rate   DECIMAL(10,2) DEFAULT 0 CHECK (hourly_rate >= 0),
    rating        DECIMAL(3,1)  DEFAULT 0,
    reviews_count INTEGER       DEFAULT 0,
    is_online     BOOLEAN       DEFAULT false,
    city          VARCHAR(100),
    zip_code      VARCHAR(15),
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- Unique email index (active profiles only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_active
    ON public.profiles (email) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role
    ON public.profiles (role) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_work_category
    ON public.profiles (work_category) WHERE role = 'technician' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_created_at
    ON public.profiles (created_at);

-- ----------------------------------------------------------------------------
-- 2. services  (service catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(30)  NOT NULL
                CHECK (category IN ('cleaning', 'repair', 'electrical', 'beauty')),
    description TEXT,
    base_rate   DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (base_rate >= 0),
    icon_name   VARCHAR(50),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category
    ON public.services (category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_name_search
    ON public.services USING gin(to_tsvector('english', name));

-- ----------------------------------------------------------------------------
-- 3. jobs  (service bookings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_code          VARCHAR(20) UNIQUE NOT NULL DEFAULT '',
    service_id        UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_type      VARCHAR(100) NOT NULL,
    service_category  VARCHAR(30)  NOT NULL DEFAULT 'cleaning'
                      CHECK (service_category IN ('cleaning', 'repair', 'electrical', 'beauty')),

    -- Customer / location
    customer_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_name     VARCHAR(100),
    customer_phone    VARCHAR(30),
    customer_avatar   TEXT,
    address           VARCHAR(255),
    apartment         VARCHAR(100),
    city              VARCHAR(100),
    zip_code          VARCHAR(15),

    -- Technician
    technician_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    technician_name   VARCHAR(100),
    technician_avatar TEXT,

    -- Scheduling
    scheduled_date    DATE,
    time_slot         VARCHAR(20) DEFAULT 'morning'
                      CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    rooms             VARCHAR(30),
    duration          INTEGER DEFAULT 2 CHECK (duration > 0),
    focus_areas       TEXT[] DEFAULT '{}',
    notes             TEXT,

    -- Status & pricing
    status            VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed', 'reported', 'cancelled')),
    base_rate         DECIMAL(10,2) DEFAULT 0 CHECK (base_rate >= 0),
    tax               DECIMAL(10,2) DEFAULT 0,
    travel_fee        DECIMAL(10,2) DEFAULT 0,
    add_ons_price     DECIMAL(10,2) DEFAULT 0,
    total_price       DECIMAL(10,2) DEFAULT 0,

    -- Service tracking
    elapsed_time      INTEGER DEFAULT 0,
    technician_notes  TEXT,
    before_photo      TEXT,
    after_photo       TEXT,

    -- Issue reporting
    reported_issue_type     VARCHAR(50),
    reported_issue_desc     TEXT,
    reported_issue_urgent   BOOLEAN DEFAULT false,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ
);

-- Auto-generate job_code like #SH-XXXX on insert
CREATE OR REPLACE FUNCTION public.generate_job_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.job_code = '' OR NEW.job_code IS NULL THEN
        NEW.job_code := '#SH-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_generate_code ON public.jobs;
CREATE TRIGGER trg_jobs_generate_code
    BEFORE INSERT ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.generate_job_code();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_customer
    ON public.jobs (customer_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_technician
    ON public.jobs (technician_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status
    ON public.jobs (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_category
    ON public.jobs (service_category) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date
    ON public.jobs (scheduled_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
    ON public.jobs (created_at);

-- ----------------------------------------------------------------------------
-- 4. job_checklists  (checklist items for a job)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_checklists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    text        VARCHAR(255) NOT NULL,
    completed   BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id
    ON public.job_checklists (job_id);

-- ----------------------------------------------------------------------------
-- 5. job_materials  (materials used in a job)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_materials (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    quantity    INTEGER DEFAULT 1 CHECK (quantity > 0),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_materials_job_id
    ON public.job_materials (job_id);

-- ----------------------------------------------------------------------------
-- 6. messages  (chat between customer / technician / support)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id        UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    sender_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_role   VARCHAR(20) NOT NULL
                  CHECK (sender_role IN ('customer', 'technician', 'support', 'system')),
    sender_name   VARCHAR(100),
    sender_avatar TEXT,
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_job_id
    ON public.messages (job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON public.messages (sender_id);

-- ----------------------------------------------------------------------------
-- 7. payments  (payment records for jobs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount          DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    payment_method  VARCHAR(30) DEFAULT 'credit_card'
                    CHECK (payment_method IN ('credit_card', 'digital_wallet', 'cash')),
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'escrow_held', 'completed', 'refunded', 'failed')),
    stripe_payment_intent_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_job_id
    ON public.payments (job_id);

CREATE INDEX IF NOT EXISTS idx_payments_customer
    ON public.payments (customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON public.payments (status);

-- ----------------------------------------------------------------------------
-- 8. reviews  (customer reviews for technicians)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    technician_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_job_unique
    ON public.reviews (job_id);

CREATE INDEX IF NOT EXISTS idx_reviews_technician
    ON public.reviews (technician_id);

-- ----------------------------------------------------------------------------
-- 9. technician_availability  (weekly availability slots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.technician_availability (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technician_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot       VARCHAR(20) NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    is_available    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tech_avail_unique
    ON public.technician_availability (technician_id, day_of_week, time_slot);

-- ============================================================================
-- 10. Auto-create profile when a new auth user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, work_category)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
        NEW.raw_user_meta_data->>'work_category'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 11. Auto-update updated_at on all tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_job_checklists_updated_at BEFORE UPDATE ON public.job_checklists
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tech_avail_updated_at BEFORE UPDATE ON public.technician_availability
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 12. Row Level Security (RLS) — ENABLE ON ALL TABLES
-- ============================================================================
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_availability ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 12a. profiles policies
-- ----------------------------------------------------------------------------
-- Anyone authenticated can view technician profiles (for marketplace browsing)
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL);

-- Users can view their own profile (includes deleted)
CREATE POLICY "profiles_select_self"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "profiles_update_self"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Inserts are handled by the trigger (SECURITY DEFINER), no direct insert needed
-- but we allow it for edge cases
CREATE POLICY "profiles_insert_self"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 12b. services policies
-- ----------------------------------------------------------------------------
-- Anyone (even anon) can browse active services
CREATE POLICY "services_select_all"
    ON public.services FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Only service admins can modify services (use a custom claim or service_role)
-- For now, restrict to authenticated with a check function
CREATE POLICY "services_insert_admin"
    ON public.services FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "services_update_admin"
    ON public.services FOR UPDATE
    TO authenticated
    USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 12c. jobs policies
-- ----------------------------------------------------------------------------
-- Customers see their own jobs; technicians see assigned jobs
CREATE POLICY "jobs_select_participants"
    ON public.jobs FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND (customer_id = auth.uid() OR technician_id = auth.uid())
    );

-- Customers can create jobs for themselves
CREATE POLICY "jobs_insert_customer"
    ON public.jobs FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

-- Customers and assigned technicians can update job fields
CREATE POLICY "jobs_update_participants"
    ON public.jobs FOR UPDATE
    TO authenticated
    USING (
        deleted_at IS NULL
        AND (customer_id = auth.uid() OR technician_id = auth.uid())
    )
    WITH CHECK (customer_id = auth.uid() OR technician_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 12d. job_checklists policies (inherit from job access)
-- ----------------------------------------------------------------------------
CREATE POLICY "checklists_select_participants"
    ON public.job_checklists FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

CREATE POLICY "checklists_update_technician"
    ON public.job_checklists FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND j.technician_id = auth.uid()
        )
    );

CREATE POLICY "checklists_insert_participants"
    ON public.job_checklists FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 12e. job_materials policies (same logic as checklists)
-- ----------------------------------------------------------------------------
CREATE POLICY "materials_select_participants"
    ON public.job_materials FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

CREATE POLICY "materials_insert_technician"
    ON public.job_materials FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id AND j.technician_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 12f. messages policies
-- ----------------------------------------------------------------------------
CREATE POLICY "messages_select_participants"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

CREATE POLICY "messages_insert_participants"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND (j.customer_id = auth.uid() OR j.technician_id = auth.uid())
        )
    );

-- ----------------------------------------------------------------------------
-- 12g. payments policies
-- ----------------------------------------------------------------------------
CREATE POLICY "payments_select_owner"
    ON public.payments FOR SELECT
    TO authenticated
    USING (customer_id = auth.uid());

CREATE POLICY "payments_insert_owner"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "payments_update_owner"
    ON public.payments FOR UPDATE
    TO authenticated
    USING (customer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 12h. reviews policies
-- ----------------------------------------------------------------------------
CREATE POLICY "reviews_select_all"
    ON public.reviews FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "reviews_insert_customer"
    ON public.reviews FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = job_id
            AND j.customer_id = auth.uid()
            AND j.status = 'completed'
        )
    );

-- ----------------------------------------------------------------------------
-- 12i. technician_availability policies
-- ----------------------------------------------------------------------------
CREATE POLICY "availability_select_all"
    ON public.technician_availability FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "availability_manage_self"
    ON public.technician_availability FOR ALL
    TO authenticated
    USING (technician_id = auth.uid())
    WITH CHECK (technician_id = auth.uid());

-- ============================================================================
-- 13. Updated_at trigger function for reviews (recalculate technician rating)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_technician_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        rating = (
            SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,1)
            FROM public.reviews
            WHERE technician_id = NEW.technician_id
        ),
        reviews_count = (
            SELECT COUNT(*)
            FROM public.reviews
            WHERE technician_id = NEW.technician_id
        )
    WHERE id = NEW.technician_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reviews_update_rating ON public.reviews;
CREATE TRIGGER trg_reviews_update_rating
    AFTER INSERT OR DELETE OR UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_technician_rating();

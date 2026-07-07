-- ============================================================================
-- ServiceHub Pro — Order In Progress table
-- ============================================================================
-- New orders start here. When a technician accepts the order,
-- it moves to the jobs table via the accept_order_in_progress() function.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_in_progress (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_code          VARCHAR(20) UNIQUE NOT NULL DEFAULT '',
    service_type      VARCHAR(100) NOT NULL,
    service_category  VARCHAR(30) NOT NULL DEFAULT 'cleaning'
                      CHECK (service_category IN ('cleaning', 'repair', 'electrical', 'beauty')),

    -- Customer info
    customer_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_name     VARCHAR(100),
    customer_phone    VARCHAR(30),
    customer_avatar   TEXT,

    -- Location
    address           VARCHAR(255),
    apartment         VARCHAR(100),
    city              VARCHAR(100),
    zip_code          VARCHAR(15),

    -- Scheduling
    scheduled_date    DATE,
    time_slot         VARCHAR(20) DEFAULT 'morning'
                      CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    rooms             VARCHAR(30),
    duration          INTEGER DEFAULT 2 CHECK (duration > 0),
    focus_areas       TEXT[] DEFAULT '{}',
    notes             TEXT,

    -- Pricing
    base_rate         DECIMAL(10,2) DEFAULT 0 CHECK (base_rate >= 0),
    tax               DECIMAL(10,2) DEFAULT 0,
    travel_fee        DECIMAL(10,2) DEFAULT 0,
    add_ons_price     DECIMAL(10,2) DEFAULT 0,
    total_price       DECIMAL(10,2) DEFAULT 0,

    -- Technician (set when accepted)
    technician_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    technician_name   VARCHAR(100),
    technician_avatar TEXT,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate job_code like #SH-XXXX on insert
DROP TRIGGER IF EXISTS trg_oip_generate_code ON public.order_in_progress;
CREATE TRIGGER trg_oip_generate_code
    BEFORE INSERT ON public.order_in_progress
    FOR EACH ROW EXECUTE FUNCTION public.generate_job_code();

CREATE TRIGGER trg_oip_updated_at BEFORE UPDATE ON public.order_in_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_oip_customer
    ON public.order_in_progress (customer_id);

CREATE INDEX IF NOT EXISTS idx_oip_created_at
    ON public.order_in_progress (created_at);

-- ============================================================================
-- RLS policies for order_in_progress
-- ============================================================================

ALTER TABLE public.order_in_progress ENABLE ROW LEVEL SECURITY;

-- Customers can view their own pending orders
CREATE POLICY "oip_select_customer"
    ON public.order_in_progress FOR SELECT
    TO authenticated
    USING (customer_id = auth.uid());

-- Customers can insert their own orders
CREATE POLICY "oip_insert_customer"
    ON public.order_in_progress FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid());

-- Customers can update their own orders (e.g. cancel)
CREATE POLICY "oip_update_customer"
    ON public.order_in_progress FOR UPDATE
    TO authenticated
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- Technicians can view all pending orders (to browse and accept)
CREATE POLICY "oip_select_technician"
    ON public.order_in_progress FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'technician' AND deleted_at IS NULL
        )
    );

-- Technicians can update orders they are accepting
CREATE POLICY "oip_update_technician"
    ON public.order_in_progress FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'technician' AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- Function: Accept an order_in_progress and move it to jobs table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_order_in_progress(
    p_order_id UUID,
    p_technician_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_order RECORD;
    v_job_id UUID;
    v_tech_name VARCHAR(100);
    v_tech_avatar TEXT;
BEGIN
    -- Fetch the pending order
    SELECT * INTO v_order FROM public.order_in_progress WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Fetch technician info
    SELECT name, avatar_url INTO v_tech_name, v_tech_avatar
    FROM public.profiles WHERE id = p_technician_id;

    -- Insert into jobs table
    INSERT INTO public.jobs (
        service_type, service_category,
        customer_id, customer_name, customer_phone, customer_avatar,
        address, apartment, city, zip_code,
        scheduled_date, time_slot, rooms, duration, focus_areas, notes,
        status, base_rate, tax, travel_fee, add_ons_price, total_price,
        technician_id, technician_name, technician_avatar
    ) VALUES (
        v_order.service_type, v_order.service_category,
        v_order.customer_id, v_order.customer_name, v_order.customer_phone, v_order.customer_avatar,
        v_order.address, v_order.apartment, v_order.city, v_order.zip_code,
        v_order.scheduled_date, v_order.time_slot, v_order.rooms, v_order.duration, v_order.focus_areas, v_order.notes,
        'confirmed', v_order.base_rate, v_order.tax, v_order.travel_fee, v_order.add_ons_price, v_order.total_price,
        p_technician_id, v_tech_name, v_tech_avatar
    ) RETURNING id INTO v_job_id;

    -- Delete the order_in_progress
    DELETE FROM public.order_in_progress WHERE id = p_order_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ServiceHub Pro — Role-based job acceptance enforcement
-- ============================================================================
-- Bug fix: a repair technician (work_category = 'repair') could accept a
-- cleaning job because accept_order_in_progress() performed no category check.
--
-- This migration replaces accept_order_in_progress() with a version that
-- enforces the same role/permission rule the client now applies:
--
--   A technician may accept an order only when their `work_category` matches
--   the order's `service_category`. A universal technician (work_category IS
--   NULL or 'all') may take any job.
--
-- This is the authoritative backstop. The client pre-validates for good UX,
-- but the database rejects the write regardless of what the client sends, so
-- the rule cannot be bypassed.
--
-- The function is SECURITY DEFINER so it can read the technician profile row
-- regardless of the caller's RLS; the technician id is passed explicitly as a
-- parameter (we never rely on auth.uid() inside).
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
    v_tech_category VARCHAR(30);
BEGIN
    -- Fetch the pending order
    SELECT * INTO v_order FROM public.order_in_progress WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Fetch technician info AND work category (used for role-based validation)
    SELECT name, avatar_url, work_category
      INTO v_tech_name, v_tech_avatar, v_tech_category
    FROM public.profiles WHERE id = p_technician_id;

    IF v_tech_name IS NULL THEN
        RAISE EXCEPTION 'Technician profile not found';
    END IF;

    -- Role/category validation: a technician may only accept jobs whose
    -- service_category matches their work_category, unless they are a
    -- universal technician (work_category IS NULL or 'all').
    IF v_tech_category IS NOT NULL
       AND v_tech_category <> 'all'
       AND v_tech_category <> v_order.service_category THEN
        RAISE EXCEPTION 'Technician category mismatch: specialist in %, cannot accept % job',
            v_tech_category, v_order.service_category;
    END IF;

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

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the updated
-- function signature/behavior is picked up by the Supabase JS client.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ServiceHub Pro — Seed Data
-- ============================================================================
-- Seeds the services catalog with the four service categories used by the app.
-- Run after 00001_initial_schema.sql
-- ============================================================================

INSERT INTO public.services (name, category, description, base_rate, icon_name, is_active) VALUES
    ('Deep Cleaning',        'cleaning',   'Professional deep cleaning for kitchens, bathrooms, and living spaces.',     45.00, 'sparkles', true),
    ('General Repair',       'repair',     'Home repair services including plumbing, carpentry, and fixtures.',            60.00, 'construct', true),
    ('HVAC & Electrical',    'electrical', 'Heating, ventilation, air conditioning, and electrical system maintenance.', 120.00, 'flash',    true),
    ('Beauty & Wellness',    'beauty',     'At-home beauty and wellness services.',                                         55.00, 'flower',    true)
ON CONFLICT DO NOTHING;

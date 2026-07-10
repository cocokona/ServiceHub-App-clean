-- ============================================================================
-- ServiceHub Pro — Payment Methods (customer-managed credit/debit cards)
-- ============================================================================
-- PCI-COMPLIANT BY DESIGN:
--   We NEVER store the full card number (PAN) or the CVV. We persist only a
--   tokenized record: card brand, the last 4 digits, expiry, cardholder name,
--   and a payment token. In production the `token` is issued by a PCI-compliant
--   processor (e.g. Stripe); here it is a locally generated placeholder.
--
-- PRIVACY:
--   Every row is private to its owner. RLS policies below scope all access to
--   `profile_id = auth.uid()`, so a customer can only see / modify / delete
--   their own payment methods.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand           VARCHAR(20) NOT NULL DEFAULT 'unknown'
                    CHECK (brand IN ('visa', 'mastercard', 'amex', 'discover', 'unknown')),
    last4           CHAR(4) NOT NULL,
    exp_month       INTEGER NOT NULL CHECK (exp_month BETWEEN 1 AND 12),
    exp_year        INTEGER NOT NULL CHECK (exp_year >= 2000),
    cardholder_name VARCHAR(120) NOT NULL,
    token           TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_profile
    ON public.payment_methods (profile_id);

-- ----------------------------------------------------------------------------
-- Row Level Security — every policy is scoped to the authenticated owner.
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Customers can read only their own payment methods.
CREATE POLICY "pm_select_owner"
    ON public.payment_methods FOR SELECT
    TO authenticated
    USING (profile_id = auth.uid());

-- Customers can insert rows only for themselves.
CREATE POLICY "pm_insert_owner"
    ON public.payment_methods FOR INSERT
    TO authenticated
    WITH CHECK (profile_id = auth.uid());

-- Customers can update only their own rows (e.g. toggling is_default).
CREATE POLICY "pm_update_owner"
    ON public.payment_methods FOR UPDATE
    TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Customers can delete only their own rows.
CREATE POLICY "pm_delete_owner"
    ON public.payment_methods FOR DELETE
    TO authenticated
    USING (profile_id = auth.uid());

-- ============================================================================
-- CRITICAL: Notify PostgREST to reload its schema cache so the Supabase JS
-- client recognizes the new table (otherwise it throws "Could not find the
-- table public.payment_methods in the schema cache").
-- ============================================================================
NOTIFY pgrst, 'reload schema';

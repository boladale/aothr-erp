
-- Currencies reference table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currencies readable by authenticated users"
  ON public.currencies FOR SELECT TO authenticated USING (true);

-- Seed common currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
  ('NGN', 'Nigerian Naira', '₦'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('ZAR', 'South African Rand', 'R'),
  ('GHS', 'Ghanaian Cedi', '₵'),
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('XOF', 'West African CFA Franc', 'CFA');

-- Exchange rates table
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(18,6) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(organization_id, from_currency, to_currency, effective_date)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates readable by org members"
  ON public.exchange_rates FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Exchange rates manageable by org members"
  ON public.exchange_rates FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Add multicurrency settings to organizations
ALTER TABLE public.organizations
  ADD COLUMN is_multicurrency BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'NGN';

-- Add currency columns to financial transaction tables
ALTER TABLE public.purchase_orders
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.ap_invoices
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.ap_payments
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.ar_invoices
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.ar_receipts
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.ar_credit_notes
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.sales_orders
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.sales_quotations
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.fund_transfers
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

ALTER TABLE public.gl_journal_entries
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1.0;

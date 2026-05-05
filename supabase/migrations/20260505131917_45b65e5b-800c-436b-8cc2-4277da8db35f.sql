ALTER TABLE public.vendor_registration_requests
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS payment_terms integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
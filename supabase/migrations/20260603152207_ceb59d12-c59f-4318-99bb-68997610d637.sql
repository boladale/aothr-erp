
-- 1. Extend vendor_status enum
ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'blacklisted';

-- 2. Add blacklist workflow columns
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS blacklist_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS blacklist_reason text,
  ADD COLUMN IF NOT EXISTS blacklist_requested_by uuid,
  ADD COLUMN IF NOT EXISTS blacklist_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS blacklist_approved_by uuid,
  ADD COLUMN IF NOT EXISTS blacklist_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS blacklist_rejection_reason text;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_blacklist_status_check;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_blacklist_status_check
  CHECK (blacklist_status IN ('none','pending','approved','rejected'));

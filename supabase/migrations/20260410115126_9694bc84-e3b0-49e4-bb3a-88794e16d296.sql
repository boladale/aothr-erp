
-- Add RC number to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS rc_number text;

-- Add RC number to vendor registration requests
ALTER TABLE public.vendor_registration_requests ADD COLUMN IF NOT EXISTS rc_number text;

-- Create vendor invite tokens table
CREATE TABLE public.vendor_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Users with vendor_registrations permission can manage tokens
CREATE POLICY "Authorized users can create invite tokens"
ON public.vendor_invite_tokens
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission('vendor_registrations'));

CREATE POLICY "Authorized users can view invite tokens"
ON public.vendor_invite_tokens
FOR SELECT
TO authenticated
USING (public.has_permission('vendor_registrations') OR public.has_permission('vendors'));

-- Allow public read by token value (for registration flow - anon)
CREATE POLICY "Anyone can look up token for registration"
ON public.vendor_invite_tokens
FOR SELECT
TO anon
USING (true);

-- Allow marking token as used
CREATE POLICY "Authenticated users can mark token used"
ON public.vendor_invite_tokens
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

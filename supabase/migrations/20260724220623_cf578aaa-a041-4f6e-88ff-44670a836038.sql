
-- 1. Add BoldSign settings to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS boldsign_api_key TEXT,
  ADD COLUMN IF NOT EXISTS boldsign_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Signature requests tracking table
CREATE TABLE IF NOT EXISTS public.signature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('purchase_order','rfq','vendor_contract','fixed_asset_disposal')),
  document_id UUID NOT NULL,
  document_number TEXT,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  boldsign_document_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','viewed','signed','declined','expired','failed','revoked')),
  signed_pdf_url TEXT,
  error_message TEXT,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signature_requests_org_idx ON public.signature_requests(organization_id);
CREATE INDEX IF NOT EXISTS signature_requests_doc_idx ON public.signature_requests(document_type, document_id);
CREATE INDEX IF NOT EXISTS signature_requests_boldsign_idx ON public.signature_requests(boldsign_document_id);

GRANT SELECT, INSERT, UPDATE ON public.signature_requests TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

-- View: any user in the same org
CREATE POLICY "org members can view signature requests"
  ON public.signature_requests FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Insert: only admin / procurement_manager / finance_manager in the org
CREATE POLICY "managers can create signature requests"
  ON public.signature_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'procurement_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
    AND sent_by = auth.uid()
  );

-- Update: managers may revoke; status updates from webhook come via service_role and bypass RLS
CREATE POLICY "managers can update signature requests"
  ON public.signature_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'procurement_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  );

-- updated_at trigger
CREATE TRIGGER update_signature_requests_updated_at
  BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Restrict access to the BoldSign API key column via a security-definer helper.
-- The `organizations` table is already RLS-protected; we add a helper so admins can
-- read/write the key without exposing it in general SELECTs from the client.
CREATE OR REPLACE FUNCTION public.get_org_boldsign_settings(_org_id UUID)
RETURNS TABLE (boldsign_enabled BOOLEAN, has_api_key BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.boldsign_enabled,
    (o.boldsign_api_key IS NOT NULL AND length(o.boldsign_api_key) > 0) AS has_api_key
  FROM public.organizations o
  WHERE o.id = _org_id
    AND o.id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.set_org_boldsign_settings(_org_id UUID, _api_key TEXT, _enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update BoldSign settings';
  END IF;
  IF _org_id <> (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Cannot update another organization';
  END IF;

  UPDATE public.organizations
  SET
    boldsign_api_key = COALESCE(NULLIF(_api_key, ''), boldsign_api_key),
    boldsign_enabled = _enabled,
    updated_at = now()
  WHERE id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_boldsign_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_boldsign_settings(UUID, TEXT, BOOLEAN) TO authenticated;

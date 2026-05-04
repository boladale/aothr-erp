CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  estimated_cost NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view services"
ON public.services FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());

CREATE POLICY "Org members manage services"
ON public.services FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.requisition_lines
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id);

ALTER TABLE public.requisition_lines
  ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE public.requisition_lines
  ADD CONSTRAINT requisition_lines_item_or_service_chk
  CHECK (item_id IS NOT NULL OR service_id IS NOT NULL);
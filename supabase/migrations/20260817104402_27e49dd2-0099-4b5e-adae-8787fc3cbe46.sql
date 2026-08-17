CREATE TABLE public.po_payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  milestone_no integer NOT NULL,
  description text NOT NULL DEFAULT '',
  basis text NOT NULL DEFAULT 'percentage',
  percentage numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (po_id, milestone_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_payment_milestones TO authenticated;
GRANT ALL ON public.po_payment_milestones TO service_role;

ALTER TABLE public.po_payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can view PO milestones"
ON public.po_payment_milestones FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());

CREATE POLICY "PO users can manage milestones"
ON public.po_payment_milestones FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id() AND public.has_permission('purchase_orders'))
WITH CHECK (organization_id = public.get_user_org_id() AND public.has_permission('purchase_orders'));

CREATE TRIGGER set_po_payment_milestones_org
BEFORE INSERT ON public.po_payment_milestones
FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TRIGGER update_po_payment_milestones_updated_at
BEFORE UPDATE ON public.po_payment_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_po_payment_milestones_po ON public.po_payment_milestones(po_id);
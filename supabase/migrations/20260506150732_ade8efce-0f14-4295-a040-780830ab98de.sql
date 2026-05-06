
-- Vendor PO acknowledgments table
CREATE TABLE IF NOT EXISTS public.vendor_po_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('accepted','rejected')),
  acknowledged_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_po_acks_po ON public.vendor_po_acknowledgments(po_id);
CREATE INDEX IF NOT EXISTS idx_vendor_po_acks_vendor ON public.vendor_po_acknowledgments(vendor_id);

ALTER TABLE public.vendor_po_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Helper: is current auth user a linked active user for this vendor?
CREATE OR REPLACE FUNCTION public.is_vendor_user_for(_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_users
    WHERE vendor_id = _vendor_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- RLS for ack table
CREATE POLICY "Vendor users see their acks"
ON public.vendor_po_acknowledgments FOR SELECT
USING (public.is_vendor_user_for(vendor_id) OR EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = po_id AND po.organization_id = public.get_user_org_id()
));

CREATE POLICY "Vendor users insert acks"
ON public.vendor_po_acknowledgments FOR INSERT
WITH CHECK (public.is_vendor_user_for(vendor_id) AND acknowledged_by = auth.uid());

-- Allow vendor users to view their POs (cross-org)
CREATE POLICY "Vendor users view their POs"
ON public.purchase_orders FOR SELECT
USING (public.is_vendor_user_for(vendor_id));

-- Allow vendor users to update acceptance fields on their POs
CREATE POLICY "Vendor users update acceptance on their POs"
ON public.purchase_orders FOR UPDATE
USING (public.is_vendor_user_for(vendor_id))
WITH CHECK (public.is_vendor_user_for(vendor_id));

-- Allow vendor users to view PO lines for their POs
CREATE POLICY "Vendor users view their PO lines"
ON public.purchase_order_lines FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_lines.po_id
    AND public.is_vendor_user_for(po.vendor_id)
));

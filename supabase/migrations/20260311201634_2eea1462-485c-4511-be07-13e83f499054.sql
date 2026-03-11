ALTER POLICY "Procurement and admin can manage PO lines"
ON public.purchase_order_lines
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_lines.po_id
        AND po.organization_id = public.get_user_org_id()
    )
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  )
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_lines.po_id
        AND po.organization_id = public.get_user_org_id()
    )
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'procurement_officer'::public.app_role)
  )
);
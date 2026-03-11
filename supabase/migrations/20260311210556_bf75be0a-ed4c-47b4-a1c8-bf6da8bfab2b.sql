ALTER POLICY "Warehouse and procurement can manage GRNs"
ON public.goods_receipts
USING (
  organization_id = get_user_org_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'procurement_manager'::app_role)
    OR has_role(auth.uid(), 'procurement_officer'::app_role)
    OR has_role(auth.uid(), 'warehouse_manager'::app_role)
    OR has_role(auth.uid(), 'warehouse_officer'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_org_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'procurement_manager'::app_role)
    OR has_role(auth.uid(), 'procurement_officer'::app_role)
    OR has_role(auth.uid(), 'warehouse_manager'::app_role)
    OR has_role(auth.uid(), 'warehouse_officer'::app_role)
  )
);

ALTER POLICY "Warehouse and procurement can manage GRN lines"
ON public.goods_receipt_lines
USING (
  EXISTS (
    SELECT 1
    FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND gr.organization_id = get_user_org_id()
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'procurement_manager'::app_role)
    OR has_role(auth.uid(), 'procurement_officer'::app_role)
    OR has_role(auth.uid(), 'warehouse_manager'::app_role)
    OR has_role(auth.uid(), 'warehouse_officer'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND gr.organization_id = get_user_org_id()
  )
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'procurement_manager'::app_role)
    OR has_role(auth.uid(), 'procurement_officer'::app_role)
    OR has_role(auth.uid(), 'warehouse_manager'::app_role)
    OR has_role(auth.uid(), 'warehouse_officer'::app_role)
  )
);
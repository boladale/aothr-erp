
-- Drop and recreate the ALL policies on rfp_items and rfp_criteria to include procurement_officer
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_items" ON public.rfp_items;
CREATE POLICY "Procurement and admin can manage rfp_items" ON public.rfp_items
FOR ALL TO authenticated
USING (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_items.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_items.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
);

DROP POLICY IF EXISTS "Procurement and admin can manage rfp_criteria" ON public.rfp_criteria;
CREATE POLICY "Procurement and admin can manage rfp_criteria" ON public.rfp_criteria
FOR ALL TO authenticated
USING (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_criteria.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_criteria.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
);

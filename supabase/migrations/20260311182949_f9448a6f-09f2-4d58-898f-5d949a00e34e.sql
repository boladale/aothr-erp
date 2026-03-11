
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_proposals" ON public.rfp_proposals;
CREATE POLICY "Procurement and admin can manage rfp_proposals" ON public.rfp_proposals
FOR ALL TO authenticated
USING (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_proposals.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_proposals.rfp_id AND r.organization_id = get_user_org_id()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'procurement_officer'::app_role))
);

DROP POLICY IF EXISTS "Procurement and admin can manage rfp_proposal_lines" ON public.rfp_proposal_lines;
CREATE POLICY "Procurement and admin can manage rfp_proposal_lines"
ON public.rfp_proposal_lines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.rfps r ON r.id = p.rfp_id
    WHERE p.id = rfp_proposal_lines.proposal_id AND r.organization_id = public.get_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'procurement_manager') OR
    public.has_role(auth.uid(), 'procurement_officer') OR
    public.has_permission('rfps')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.rfps r ON r.id = p.rfp_id
    WHERE p.id = rfp_proposal_lines.proposal_id AND r.organization_id = public.get_user_org_id()
  )
  AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'procurement_manager') OR
    public.has_role(auth.uid(), 'procurement_officer') OR
    public.has_permission('rfps')
  )
);
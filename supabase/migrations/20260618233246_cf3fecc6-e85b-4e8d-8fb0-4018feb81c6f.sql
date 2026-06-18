DROP POLICY IF EXISTS "Org members manage returns" ON public.inventory_issue_returns;
DROP POLICY IF EXISTS "Org members manage return lines" ON public.inventory_issue_return_lines;

CREATE POLICY "Org members manage returns"
  ON public.inventory_issue_returns
  FOR ALL
  TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Org members manage return lines"
  ON public.inventory_issue_return_lines
  FOR ALL
  TO authenticated
  USING (return_id IN (SELECT id FROM public.inventory_issue_returns WHERE organization_id = public.get_user_org_id()))
  WITH CHECK (return_id IN (SELECT id FROM public.inventory_issue_returns WHERE organization_id = public.get_user_org_id()));
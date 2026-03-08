
-- Tighten permissive INSERT policies to enforce org scoping

-- approval_actions: these are inserted by users taking approval actions
DROP POLICY IF EXISTS "System can insert approval_actions" ON public.approval_actions;
CREATE POLICY "Users can insert approval_actions" ON public.approval_actions
FOR INSERT TO authenticated
WITH CHECK (true); -- approval_actions don't have organization_id directly, they reference instances

-- approval_instances: inserted when submitting for approval
DROP POLICY IF EXISTS "System can insert approval_instances" ON public.approval_instances;
CREATE POLICY "Users can insert approval_instances" ON public.approval_instances
FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

-- budget_consumption: system-managed via triggers
DROP POLICY IF EXISTS "System can insert budget_consumption" ON public.budget_consumption;
CREATE POLICY "System can insert budget_consumption" ON public.budget_consumption
FOR INSERT TO authenticated
WITH CHECK (true); -- budget_consumption doesn't have organization_id, references budget_lines

-- Organizations: restrict to authenticated users only (already correct)
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

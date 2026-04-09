
-- Drop and recreate policies to include global rules (organization_id IS NULL)
DROP POLICY IF EXISTS "Users can view org approval_rules" ON public.approval_rules;
DROP POLICY IF EXISTS "Auth users can manage org approval_rules" ON public.approval_rules;

CREATE POLICY "Users can view approval_rules"
ON public.approval_rules
FOR SELECT
TO authenticated
USING (organization_id = get_user_org_id() OR organization_id IS NULL);

CREATE POLICY "Auth users can manage org approval_rules"
ON public.approval_rules
FOR ALL
TO authenticated
USING (organization_id = get_user_org_id())
WITH CHECK (organization_id = get_user_org_id());

-- Same for approval_steps
DROP POLICY IF EXISTS "Users can view org approval_steps" ON public.approval_steps;
DROP POLICY IF EXISTS "Auth users can manage org approval_steps" ON public.approval_steps;

CREATE POLICY "Users can view approval_steps"
ON public.approval_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.approval_rules r
    WHERE r.id = rule_id
    AND (r.organization_id = get_user_org_id() OR r.organization_id IS NULL)
  )
);

CREATE POLICY "Auth users can manage org approval_steps"
ON public.approval_steps
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.approval_rules r
    WHERE r.id = rule_id
    AND r.organization_id = get_user_org_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.approval_rules r
    WHERE r.id = rule_id
    AND r.organization_id = get_user_org_id()
  )
);

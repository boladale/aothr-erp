
-- Allow users to see organizations they created (needed during org setup before profile is updated)
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;
CREATE POLICY "Users can view own organization" ON public.organizations
FOR SELECT TO authenticated
USING (id = get_user_org_id() OR created_by = auth.uid());

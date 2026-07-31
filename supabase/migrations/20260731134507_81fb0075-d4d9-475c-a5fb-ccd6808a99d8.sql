DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;

DROP POLICY IF EXISTS "Users can create requisitions" ON public.requisitions;
CREATE POLICY "Users can create requisitions"
ON public.requisitions FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND organization_id = public.get_user_org_id());

DROP POLICY IF EXISTS vendor_reg_admin_select ON public.vendor_registration_requests;
DROP POLICY IF EXISTS vendor_reg_admin_update ON public.vendor_registration_requests;

CREATE POLICY vendor_reg_admin_select
ON public.vendor_registration_requests FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'procurement_manager'::app_role])
  )
);

CREATE POLICY vendor_reg_admin_update
ON public.vendor_registration_requests FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'procurement_manager'::app_role])
  )
)
WITH CHECK (organization_id = public.get_user_org_id());

DROP POLICY IF EXISTS vendor_users_admin_select ON public.vendor_users;
DROP POLICY IF EXISTS vendor_users_admin_insert ON public.vendor_users;
DROP POLICY IF EXISTS vendor_users_admin_update ON public.vendor_users;

CREATE POLICY vendor_users_admin_select
ON public.vendor_users FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_users.vendor_id
      AND v.organization_id = public.get_user_org_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'procurement_manager'::app_role])
  )
);

CREATE POLICY vendor_users_admin_insert
ON public.vendor_users FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_users.vendor_id
      AND v.organization_id = public.get_user_org_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'procurement_manager'::app_role])
  )
);

CREATE POLICY vendor_users_admin_update
ON public.vendor_users FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_users.vendor_id
      AND v.organization_id = public.get_user_org_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::app_role, 'procurement_manager'::app_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_users.vendor_id
      AND v.organization_id = public.get_user_org_id()
  )
);
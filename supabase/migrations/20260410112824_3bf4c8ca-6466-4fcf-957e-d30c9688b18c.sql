
-- Allow users who can manage vendor registrations to assign vendor_user role
CREATE POLICY "Vendor registration approvers can assign vendor_user role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'vendor_user'::app_role
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN app_role_permissions arp ON arp.app_role = ur.role
    JOIN permissions p ON p.id = arp.permission_id
    WHERE ur.user_id = auth.uid() AND p.code = 'vendor_registrations'
  )
);

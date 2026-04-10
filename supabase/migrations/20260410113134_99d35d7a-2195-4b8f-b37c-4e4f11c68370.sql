
-- Create a security definer function to check if current user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN app_role_permissions arp ON arp.app_role = ur.role
    JOIN permissions p ON p.id = arp.permission_id
    WHERE ur.user_id = auth.uid() AND p.code = p_code
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Vendor registration approvers can assign vendor_user role" ON public.user_roles;

-- Recreate using the security definer function
CREATE POLICY "Vendor registration approvers can assign vendor_user role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'vendor_user'::app_role
  AND public.has_permission('vendor_registrations')
);

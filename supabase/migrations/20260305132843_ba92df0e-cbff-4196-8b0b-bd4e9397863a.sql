
-- Allow admins to manage roles
CREATE POLICY "Admins can manage roles" ON public.roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage permissions
CREATE POLICY "Admins can manage permissions" ON public.permissions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to manage role_permissions
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

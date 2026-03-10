
-- Allow authenticated users to insert their own admin role (for org creation flow)
-- The org setup code only inserts the creator's own role
CREATE POLICY "Users can insert own role during org setup"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

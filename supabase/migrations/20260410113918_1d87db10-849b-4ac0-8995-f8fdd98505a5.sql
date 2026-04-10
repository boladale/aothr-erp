
-- Allow vendor_user role to see their own linked vendor
CREATE POLICY "Vendor users can view own vendor"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM vendor_users vu
    WHERE vu.vendor_id = vendors.id
    AND vu.user_id = auth.uid()
    AND vu.is_active = true
  )
);

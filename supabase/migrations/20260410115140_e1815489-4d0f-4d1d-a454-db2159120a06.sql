
DROP POLICY IF EXISTS "Authenticated users can mark token used" ON public.vendor_invite_tokens;

CREATE POLICY "Authenticated users can mark own token used"
ON public.vendor_invite_tokens
FOR UPDATE
TO authenticated
USING (used_at IS NULL)
WITH CHECK (used_at IS NOT NULL);

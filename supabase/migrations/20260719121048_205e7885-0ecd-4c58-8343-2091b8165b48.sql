DROP FUNCTION IF EXISTS public.lookup_vendor_invite_token(text);
CREATE OR REPLACE FUNCTION public.lookup_vendor_invite_token(p_token text)
RETURNS TABLE(id uuid, vendor_id uuid, email text, vendor_name text, expires_at timestamptz, used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.vendor_id, t.email, v.name AS vendor_name, t.expires_at, t.used_at
  FROM public.vendor_invite_tokens t
  LEFT JOIN public.vendors v ON v.id = t.vendor_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_vendor_invite_token(text) TO anon, authenticated;
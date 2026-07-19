
-- 1. vendor_invite_tokens: no anon SELECT; safe lookup RPC
DROP POLICY IF EXISTS "Anyone can look up token for registration" ON public.vendor_invite_tokens;
DROP POLICY IF EXISTS "Public can look up token for registration" ON public.vendor_invite_tokens;

CREATE OR REPLACE FUNCTION public.lookup_vendor_invite_token(p_token text)
RETURNS TABLE (id uuid, vendor_id uuid, email text, expires_at timestamptz, used_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, vendor_id, email, expires_at, used_at
  FROM public.vendor_invite_tokens
  WHERE token = p_token AND used_at IS NULL AND expires_at > now()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lookup_vendor_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_vendor_invite_token(text) TO anon, authenticated;

-- 2. vendor_invite_tokens: restrict UPDATE via controlled function
DROP POLICY IF EXISTS "Authenticated users can mark own token used" ON public.vendor_invite_tokens;

CREATE OR REPLACE FUNCTION public.consume_vendor_invite_token(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_updated int;
BEGIN
  UPDATE public.vendor_invite_tokens SET used_at = now()
  WHERE token = p_token AND used_at IS NULL AND expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_vendor_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_vendor_invite_token(text) TO anon, authenticated;

-- 3. transaction-attachments: require login to read
DROP POLICY IF EXISTS "Auth users can view transaction-attachments" ON storage.objects;
CREATE POLICY "Auth users can view transaction-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'transaction-attachments');

-- 4. signatures: require login to read
DROP POLICY IF EXISTS "Signatures are publicly viewable" ON storage.objects;
CREATE POLICY "Signatures viewable by authenticated users"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signatures');

-- 5. data-backups: scope to caller's org folder
DROP POLICY IF EXISTS "Auth users can read backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload backups" ON storage.objects;

CREATE POLICY "Users read own org backups"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'data-backups'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

CREATE POLICY "Users upload own org backups"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'data-backups'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

CREATE POLICY "Users delete own org backups"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'data-backups'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

-- 6. org-logos: scope writes to caller's org folder
DROP POLICY IF EXISTS "Auth users can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete org logos" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_delete" ON storage.objects;

CREATE POLICY "org_logos_insert_own_org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'org-logos'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

CREATE POLICY "org_logos_update_own_org"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'org-logos'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text)
WITH CHECK (bucket_id = 'org-logos'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

CREATE POLICY "org_logos_delete_own_org"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'org-logos'
       AND (storage.foldername(name))[1] = public.get_user_org_id()::text);

-- 7. requisition_bid_requests INSERT
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='requisition_bid_requests' AND cmd='INSERT'
  LOOP EXECUTE format('DROP POLICY %I ON public.requisition_bid_requests', p.policyname); END LOOP;
END $$;
CREATE POLICY "org_insert_bid_requests"
ON public.requisition_bid_requests FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

-- 8. bid_invitations INSERT
DROP POLICY IF EXISTS "org_insert_invitations" ON public.bid_invitations;
CREATE POLICY "org_insert_invitations"
ON public.bid_invitations FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

-- 9. approval_actions INSERT
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='approval_actions' AND cmd='INSERT'
  LOOP EXECUTE format('DROP POLICY %I ON public.approval_actions', p.policyname); END LOOP;
END $$;
CREATE POLICY "users_insert_own_approval_actions"
ON public.approval_actions FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- 10. budget_consumption INSERT
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='budget_consumption' AND cmd='INSERT'
  LOOP EXECUTE format('DROP POLICY %I ON public.budget_consumption', p.policyname); END LOOP;
END $$;
CREATE POLICY "org_insert_budget_consumption"
ON public.budget_consumption FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budget_lines bl
    JOIN public.budgets b ON b.id = bl.budget_id
    WHERE bl.id = budget_consumption.budget_line_id
      AND b.organization_id = public.get_user_org_id()
  )
);

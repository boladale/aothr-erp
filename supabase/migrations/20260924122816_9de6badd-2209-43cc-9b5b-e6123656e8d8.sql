-- Per-company OpenAI key (write-only from the app; read only by server functions)
CREATE TABLE public.ai_provider_keys (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  openai_api_key text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_provider_keys TO service_role;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
-- no client policies: nobody can read the key from the browser

CREATE OR REPLACE FUNCTION public.get_org_openai_settings()
RETURNS TABLE(has_key boolean, key_hint text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (k.openai_api_key IS NOT NULL AND length(k.openai_api_key) > 0),
         CASE WHEN k.openai_api_key IS NULL THEN NULL ELSE '…' || right(k.openai_api_key, 4) END,
         k.updated_at
  FROM public.ai_provider_keys k
  WHERE public.has_role(auth.uid(), 'admin')
    AND k.organization_id = public.get_user_org_id();
$$;

CREATE OR REPLACE FUNCTION public.set_org_openai_key(_api_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.get_user_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can change the OpenAI key'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'You are not linked to a company'; END IF;
  IF _api_key IS NULL OR length(trim(_api_key)) = 0 THEN
    DELETE FROM public.ai_provider_keys WHERE organization_id = v_org;
    RETURN;
  END IF;
  IF trim(_api_key) !~ '^sk-' THEN RAISE EXCEPTION 'That does not look like an OpenAI key (it should start with sk-)'; END IF;
  INSERT INTO public.ai_provider_keys(organization_id, openai_api_key, updated_by, updated_at)
  VALUES (v_org, trim(_api_key), auth.uid(), now())
  ON CONFLICT (organization_id) DO UPDATE SET openai_api_key = EXCLUDED.openai_api_key, updated_by = EXCLUDED.updated_by, updated_at = now();
  UPDATE public.ai_settings SET ai_provider = 'openai' WHERE organization_id = v_org;
END $$;

REVOKE ALL ON FUNCTION public.get_org_openai_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_org_openai_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_openai_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_openai_key(text) TO authenticated;

-- ===== Security warning cleanup =====
DO $$
DECLARE r record;
  policy_text text;
  anon_keep text[] := ARRAY['lookup_vendor_invite_token','consume_vendor_invite_token'];
BEGIN
  SELECT string_agg(coalesce(qual,'') || ' ' || coalesce(with_check,''), ' ') INTO policy_text FROM pg_policies;

  -- 1. Fix mutable search_path
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prokind='f'
             AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname, t.typname AS rettype
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_type t ON t.oid=p.prorettype
           WHERE n.nspname='public' AND p.prosecdef
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
  LOOP
    -- 2. Trigger functions never need to be callable directly
    IF r.rettype IN ('trigger','event_trigger') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    -- 3. Email queue internals: server only
    ELSIF r.proname IN ('enqueue_email','delete_email','move_to_dlq','read_email_batch','email_queue_dispatch','cleanup_transactional_data') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    -- 4. Everything else: signed-in only, unless a public page needs it
    ELSIF NOT (r.proname = ANY(anon_keep)) AND position(r.proname || '(' IN policy_text) = 0 THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END $$;
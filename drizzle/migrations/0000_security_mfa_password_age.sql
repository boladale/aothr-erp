CREATE TABLE public.org_security_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  mfa_required boolean NOT NULL DEFAULT false,
  password_max_age_days integer NOT NULL DEFAULT 90 CHECK (password_max_age_days BETWEEN 0 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.org_security_settings TO authenticated;
GRANT ALL ON public.org_security_settings TO service_role;
ALTER TABLE public.org_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own org security settings" ON public.org_security_settings
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "Admins insert own org security settings" ON public.org_security_settings
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update own org security settings" ON public.org_security_settings
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_password_status (
  user_id uuid PRIMARY KEY,
  password_changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_password_status TO authenticated;
GRANT ALL ON public.user_password_status TO service_role;
ALTER TABLE public.user_password_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own password status" ON public.user_password_status
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.mfa_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mfa_backup_codes_user_idx ON public.mfa_backup_codes(user_id);
GRANT ALL ON public.mfa_backup_codes TO service_role;
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_security_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_org uuid; v_req boolean := false; v_days int := 90; v_changed timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_org := public.get_user_org_id();
  SELECT mfa_required, password_max_age_days INTO v_req, v_days FROM org_security_settings WHERE organization_id = v_org;
  v_req := coalesce(v_req, false); v_days := coalesce(v_days, 90);
  INSERT INTO user_password_status(user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT password_changed_at INTO v_changed FROM user_password_status WHERE user_id = v_uid;
  RETURN jsonb_build_object(
    'mfa_required', v_req,
    'password_max_age_days', v_days,
    'password_changed_at', v_changed,
    'password_expired', (v_days > 0 AND v_changed < now() - make_interval(days => v_days))
  );
END $$;
REVOKE ALL ON FUNCTION public.get_my_security_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_security_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO user_password_status(user_id, password_changed_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET password_changed_at = now();
$$;
REVOKE ALL ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;
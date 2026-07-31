DROP POLICY IF EXISTS "Admins can view email event settings" ON public.email_event_settings;
DROP POLICY IF EXISTS "Admins can insert email event settings" ON public.email_event_settings;
DROP POLICY IF EXISTS "Admins can update email event settings" ON public.email_event_settings;
DROP POLICY IF EXISTS "Admins can delete email event settings" ON public.email_event_settings;

CREATE POLICY "Admins view own org email event settings"
ON public.email_event_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id());

CREATE POLICY "Admins insert own org email event settings"
ON public.email_event_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id());

CREATE POLICY "Admins update own org email event settings"
ON public.email_event_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id());

CREATE POLICY "Admins delete own org email event settings"
ON public.email_event_settings FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id());
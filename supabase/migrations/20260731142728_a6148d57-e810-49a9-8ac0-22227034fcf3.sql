DROP POLICY IF EXISTS "Admins view own org email event settings" ON public.email_event_settings;

CREATE POLICY "Org members view own org email event settings"
ON public.email_event_settings
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_org_id());
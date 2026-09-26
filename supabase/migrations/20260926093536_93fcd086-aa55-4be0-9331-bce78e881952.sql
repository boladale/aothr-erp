-- Attachments: bind inserts to the uploader
DROP POLICY IF EXISTS "Auth users can upload attachments" ON public.transaction_attachments;
CREATE POLICY "Auth users can upload attachments" ON public.transaction_attachments
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- Role permissions: users see only mappings for their own roles; admins see all
DROP POLICY IF EXISTS "Auth users can view app_role_permissions" ON public.app_role_permissions;
CREATE POLICY "Users view own role permissions" ON public.app_role_permissions
  FOR SELECT TO authenticated
  USING (app_role = ANY (public.get_user_roles(auth.uid())) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Auth users can view permissions" ON public.permissions;
CREATE POLICY "Users view permissions of their roles" ON public.permissions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.app_role_permissions arp
               WHERE arp.permission_id = permissions.id
                 AND arp.app_role = ANY (public.get_user_roles(auth.uid())))
  );

-- Workflows: scope to the user's organization (or shared defaults)
DROP POLICY IF EXISTS "Authenticated users can view workflows" ON public.workflows;
CREATE POLICY "Org members can view workflows" ON public.workflows
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = public.get_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can view workflow states" ON public.workflow_states;
CREATE POLICY "Org members can view workflow states" ON public.workflow_states
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_states.workflow_id
    AND (w.organization_id IS NULL OR w.organization_id = public.get_user_org_id())));

DROP POLICY IF EXISTS "Authenticated users can view workflow transitions" ON public.workflow_transitions;
CREATE POLICY "Org members can view workflow transitions" ON public.workflow_transitions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflows w WHERE w.id = workflow_transitions.workflow_id
    AND (w.organization_id IS NULL OR w.organization_id = public.get_user_org_id())));

DROP POLICY IF EXISTS "Authenticated users can view workflow auto actions" ON public.workflow_auto_actions;
CREATE POLICY "Org members can view workflow auto actions" ON public.workflow_auto_actions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_transitions t JOIN public.workflows w ON w.id = t.workflow_id
    WHERE t.id = workflow_auto_actions.transition_id
      AND (w.organization_id IS NULL OR w.organization_id = public.get_user_org_id())));

-- Storage uploads: bind to the uploading user
DROP POLICY IF EXISTS "Auth users can upload vendor documents" ON storage.objects;
CREATE POLICY "Auth users can upload vendor documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-documents' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Auth users can upload to transaction-attachments" ON storage.objects;
CREATE POLICY "Auth users can upload to transaction-attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'transaction-attachments' AND owner_id = (select auth.uid()::text));
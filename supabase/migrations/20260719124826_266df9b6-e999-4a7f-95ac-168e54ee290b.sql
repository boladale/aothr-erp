
-- ================= 1. Fixed Assets: scope to organization =================
DROP POLICY IF EXISTS "Auth users manage fixed assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "Auth users manage fa categories" ON public.fixed_asset_categories;
DROP POLICY IF EXISTS "Auth users manage fa depreciation" ON public.fixed_asset_depreciation;

CREATE POLICY "Org users manage fixed assets" ON public.fixed_assets
FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Org users manage fa categories" ON public.fixed_asset_categories
FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Org users manage fa depreciation" ON public.fixed_asset_depreciation
FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- ================= 2. Requisitions & lines: remove permissive SELECT =================
DROP POLICY IF EXISTS "Authenticated users can view requisitions" ON public.requisitions;
DROP POLICY IF EXISTS "Authenticated users can view requisition lines" ON public.requisition_lines;
-- Also remove the ALL-INSERT "Users can manage requisition lines" (auth.uid() IS NOT NULL) which allows cross-org inserts
DROP POLICY IF EXISTS "Users can manage requisition lines" ON public.requisition_lines;

-- Add org-scoped SELECT that also permits vendor users invited to bid (existing policy already covers vendors on lines)
CREATE POLICY "Org users view requisitions" ON public.requisitions
FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());

CREATE POLICY "Org users view requisition lines" ON public.requisition_lines
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.requisitions r
  WHERE r.id = requisition_lines.requisition_id
    AND r.organization_id = public.get_user_org_id()
));

-- ================= 3. PO ↔ Requisition line mappings =================
DROP POLICY IF EXISTS "Authenticated users can view po_line_requisition_lines" ON public.po_line_requisition_lines;

CREATE POLICY "Org users view po_line_req_lines" ON public.po_line_requisition_lines
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_order_lines pol
  JOIN public.purchase_orders po ON po.id = pol.po_id
  WHERE pol.id = po_line_requisition_lines.po_line_id
    AND po.organization_id = public.get_user_org_id()
));

-- ================= 4. user_roles self-insert: block privilege escalation =================
DROP POLICY IF EXISTS "Users can insert own role during org setup" ON public.user_roles;

CREATE POLICY "Users self-insert non-privileged role or bootstrap admin" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Safe self-service roles
    role IN ('employee'::app_role, 'viewer'::app_role, 'requisitioner'::app_role)
    OR (
      -- Bootstrap: the org founder self-assigns admin exactly once
      role = 'admin'::app_role
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        JOIN public.profiles p ON p.organization_id = o.id
        WHERE p.user_id = auth.uid()
          AND o.created_by = auth.uid()
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p2 ON p2.user_id = ur.user_id
        WHERE ur.role = 'admin'::app_role
          AND p2.organization_id = (
            SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
          )
      )
    )
  )
);

-- ================= 5. Storage: vendor-documents scoped to owning vendor/org =================
DROP POLICY IF EXISTS "Auth users can view vendor documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload vendor documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete vendor documents" ON storage.objects;

CREATE POLICY "Org users view vendor documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vendor-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.vendor_documents vd
      WHERE vd.file_url LIKE '%/' || storage.objects.name
        AND vd.organization_id = public.get_user_org_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_users vu
      WHERE vu.user_id = auth.uid()
        AND vu.is_active = true
        AND vu.vendor_id::text = split_part(storage.objects.name, '/', 1)
    )
    OR split_part(storage.objects.name, '/', 1) = 'registrations'
       AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
  )
);

CREATE POLICY "Auth users can upload vendor documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Org managers can delete vendor documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1 FROM public.vendor_documents vd
    WHERE vd.file_url LIKE '%/' || storage.objects.name
      AND vd.organization_id = public.get_user_org_id()
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'procurement_manager'))
  )
);

-- ================= 6. Storage: transaction-attachments scoped by org =================
DROP POLICY IF EXISTS "Auth users can view transaction-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Uploader can delete from transaction-attachments" ON storage.objects;

CREATE POLICY "Org users view transaction attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND EXISTS (
    SELECT 1 FROM public.transaction_attachments ta
    WHERE ta.file_url LIKE '%/' || storage.objects.name
      AND ta.organization_id = public.get_user_org_id()
  )
);

CREATE POLICY "Uploader or admin can delete transaction attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND EXISTS (
    SELECT 1 FROM public.transaction_attachments ta
    WHERE ta.file_url LIKE '%/' || storage.objects.name
      AND ta.organization_id = public.get_user_org_id()
      AND (ta.uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);

-- ================= 7. Storage: signatures only viewable by owner =================
DROP POLICY IF EXISTS "Signatures viewable by authenticated users" ON storage.objects;

CREATE POLICY "Users view own signature files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'signatures'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

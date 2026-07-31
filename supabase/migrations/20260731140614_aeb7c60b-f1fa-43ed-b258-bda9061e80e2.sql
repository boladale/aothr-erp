-- Helper: does a vendor belong to the current user's organization?
CREATE OR REPLACE FUNCTION public.vendor_in_user_org(_vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = _vendor_id AND v.organization_id = public.get_user_org_id()
  );
$$;

-- Helper: is the current user a vendor user invited to bid on this requisition?
CREATE OR REPLACE FUNCTION public.is_vendor_invited_to_requisition(_requisition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.requisition_bid_requests br
    JOIN public.bid_invitations bi ON bi.bid_request_id = br.id
    JOIN public.vendor_users vu ON vu.vendor_id = bi.vendor_id
    WHERE br.requisition_id = _requisition_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.vendor_in_user_org(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_vendor_invited_to_requisition(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.vendor_in_user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_invited_to_requisition(uuid) TO authenticated;

-- Break the loop on vendors
DROP POLICY IF EXISTS "Vendor users can view own vendor" ON public.vendors;
CREATE POLICY "Vendor users can view own vendor"
ON public.vendors FOR SELECT TO authenticated
USING (public.is_vendor_user_for(id));

-- Break the loop on vendor_users
DROP POLICY IF EXISTS vendor_users_admin_select ON public.vendor_users;
CREATE POLICY vendor_users_admin_select
ON public.vendor_users FOR SELECT TO authenticated
USING (
  public.vendor_in_user_org(vendor_id)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role))
);

DROP POLICY IF EXISTS vendor_users_admin_insert ON public.vendor_users;
CREATE POLICY vendor_users_admin_insert
ON public.vendor_users FOR INSERT TO authenticated
WITH CHECK (
  public.vendor_in_user_org(vendor_id)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role))
);

DROP POLICY IF EXISTS vendor_users_admin_update ON public.vendor_users;
CREATE POLICY vendor_users_admin_update
ON public.vendor_users FOR UPDATE TO authenticated
USING (
  public.vendor_in_user_org(vendor_id)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'procurement_manager'::app_role))
)
WITH CHECK (public.vendor_in_user_org(vendor_id));

-- Break the loop on requisitions
DROP POLICY IF EXISTS vendor_select_invited_requisitions ON public.requisitions;
CREATE POLICY vendor_select_invited_requisitions
ON public.requisitions FOR SELECT TO authenticated
USING (public.is_vendor_invited_to_requisition(id));

-- Bid invitations table
CREATE TABLE public.bid_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id uuid NOT NULL REFERENCES public.requisition_bid_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  status text NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_request_id, vendor_id)
);

CREATE INDEX idx_bid_invitations_vendor ON public.bid_invitations(vendor_id, status);
CREATE INDEX idx_bid_invitations_request ON public.bid_invitations(bid_request_id);

ALTER TABLE public.bid_invitations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tr_auto_org_id BEFORE INSERT ON public.bid_invitations
  FOR EACH ROW EXECUTE FUNCTION auto_set_organization_id();
CREATE TRIGGER tr_updated_at_bid_invitations BEFORE UPDATE ON public.bid_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Org users: full visibility within their org
CREATE POLICY "org_select_invitations" ON public.bid_invitations FOR SELECT TO authenticated
USING (organization_id = get_user_org_id());
CREATE POLICY "org_insert_invitations" ON public.bid_invitations FOR INSERT TO authenticated
WITH CHECK (true);
CREATE POLICY "org_update_invitations" ON public.bid_invitations FOR UPDATE TO authenticated
USING (organization_id = get_user_org_id());
CREATE POLICY "org_delete_invitations" ON public.bid_invitations FOR DELETE TO authenticated
USING (organization_id = get_user_org_id());

-- Vendor users: see their own invitations and update status
CREATE POLICY "vendor_select_own_invitations" ON public.bid_invitations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM vendor_users vu WHERE vu.vendor_id = bid_invitations.vendor_id AND vu.user_id = auth.uid() AND vu.is_active = true));
CREATE POLICY "vendor_update_own_invitations" ON public.bid_invitations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM vendor_users vu WHERE vu.vendor_id = bid_invitations.vendor_id AND vu.user_id = auth.uid() AND vu.is_active = true));

-- Allow vendors to read the bid_request rows they're invited to
CREATE POLICY "vendor_select_invited_bid_requests" ON public.requisition_bid_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM bid_invitations bi
  JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
  WHERE bi.bid_request_id = requisition_bid_requests.id
    AND vu.user_id = auth.uid() AND vu.is_active = true
));

-- Allow vendors to read parent requisition + lines + items for invited bids
CREATE POLICY "vendor_select_invited_requisitions" ON public.requisitions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM requisition_bid_requests br
  JOIN bid_invitations bi ON bi.bid_request_id = br.id
  JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
  WHERE br.requisition_id = requisitions.id
    AND vu.user_id = auth.uid() AND vu.is_active = true
));

CREATE POLICY "vendor_select_invited_req_lines" ON public.requisition_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM requisition_bid_requests br
  JOIN bid_invitations bi ON bi.bid_request_id = br.id
  JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
  WHERE br.requisition_id = requisition_lines.requisition_id
    AND vu.user_id = auth.uid() AND vu.is_active = true
));

-- Allow vendors to insert/update bid entries for their own vendor on requests they were invited to
CREATE POLICY "vendor_insert_own_bid_entries" ON public.requisition_bid_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bid_invitations bi
    JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
    WHERE bi.bid_request_id = requisition_bid_entries.bid_request_id
      AND bi.vendor_id = requisition_bid_entries.vendor_id
      AND vu.user_id = auth.uid() AND vu.is_active = true
  )
);

CREATE POLICY "vendor_update_own_bid_entries" ON public.requisition_bid_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bid_invitations bi
    JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
    WHERE bi.bid_request_id = requisition_bid_entries.bid_request_id
      AND bi.vendor_id = requisition_bid_entries.vendor_id
      AND vu.user_id = auth.uid() AND vu.is_active = true
  )
);

CREATE POLICY "vendor_select_own_bid_entries" ON public.requisition_bid_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM vendor_users vu
    WHERE vu.vendor_id = requisition_bid_entries.vendor_id
      AND vu.user_id = auth.uid() AND vu.is_active = true
  )
);

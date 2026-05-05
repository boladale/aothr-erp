
CREATE POLICY "vendor_select_invited_items" ON public.items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM requisition_lines rl
  JOIN requisition_bid_requests br ON br.requisition_id = rl.requisition_id
  JOIN bid_invitations bi ON bi.bid_request_id = br.id
  JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
  WHERE rl.item_id = items.id AND vu.user_id = auth.uid() AND vu.is_active = true
));

CREATE POLICY "vendor_select_invited_services" ON public.services
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM requisition_lines rl
  JOIN requisition_bid_requests br ON br.requisition_id = rl.requisition_id
  JOIN bid_invitations bi ON bi.bid_request_id = br.id
  JOIN vendor_users vu ON vu.vendor_id = bi.vendor_id
  WHERE rl.service_id = services.id AND vu.user_id = auth.uid() AND vu.is_active = true
));

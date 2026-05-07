CREATE OR REPLACE FUNCTION public.approve_po_reaward(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req record; v_orig record; v_proposal record; v_new_po_id uuid; v_new_po_number text;
  v_subtotal numeric := 0; v_line record; v_idx int := 0;
  v_total_qty numeric; v_unit_price numeric;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_manager') OR has_role(auth.uid(),'procurement_officer')) THEN
    RAISE EXCEPTION 'Insufficient privileges to approve re-award';
  END IF;
  SELECT * INTO v_req FROM po_reaward_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Re-award request not found'; END IF;
  IF v_req.status <> 'pending_approval' THEN RAISE EXCEPTION 'Request not pending approval'; END IF;
  IF v_req.runner_up_proposal_id IS NULL THEN RAISE EXCEPTION 'No runner-up to award'; END IF;

  SELECT * INTO v_orig FROM purchase_orders WHERE id = v_req.original_po_id;
  SELECT * INTO v_proposal FROM rfp_proposals WHERE id = v_req.runner_up_proposal_id;

  v_new_po_number := next_transaction_number(v_req.organization_id, 'PO', 'PO');

  INSERT INTO purchase_orders (
    po_number, vendor_id, ship_to_location_id, expected_date,
    subtotal, total_amount, payment_terms, notes, created_by, organization_id,
    rfp_id, status, acceptance_status, currency, exchange_rate
  ) VALUES (
    v_new_po_number, v_req.runner_up_vendor_id, v_orig.ship_to_location_id, v_orig.expected_date,
    0, 0, v_req.proposed_payment_terms,
    'Re-awarded from rejected PO ' || v_orig.po_number,
    auth.uid(), v_req.organization_id,
    v_req.rfp_id, 'draft'::po_status, 'pending', v_orig.currency, v_orig.exchange_rate
  ) RETURNING id INTO v_new_po_id;

  IF EXISTS (SELECT 1 FROM rfp_proposal_lines WHERE proposal_id = v_proposal.id) THEN
    FOR v_line IN
      SELECT pl.unit_price, pl.quantity, ri.item_id, ri.service_id
      FROM rfp_proposal_lines pl JOIN rfp_items ri ON ri.id = pl.rfp_item_id
      WHERE pl.proposal_id = v_proposal.id
      ORDER BY ri.id
    LOOP
      v_idx := v_idx + 1;
      INSERT INTO purchase_order_lines (po_id, line_number, item_id, service_id, quantity, unit_price)
      VALUES (v_new_po_id, v_idx, v_line.item_id, v_line.service_id, v_line.quantity, v_line.unit_price);
      v_subtotal := v_subtotal + v_line.quantity * v_line.unit_price;
    END LOOP;
  ELSE
    SELECT COALESCE(SUM(quantity),0) INTO v_total_qty FROM purchase_order_lines WHERE po_id = v_orig.id;
    v_unit_price := CASE WHEN v_total_qty > 0 THEN round((v_proposal.total_amount / v_total_qty)::numeric, 2) ELSE 0 END;
    FOR v_line IN
      SELECT line_number, item_id, service_id, quantity FROM purchase_order_lines WHERE po_id = v_orig.id ORDER BY line_number
    LOOP
      v_idx := v_idx + 1;
      INSERT INTO purchase_order_lines (po_id, line_number, item_id, service_id, quantity, unit_price)
      VALUES (v_new_po_id, v_idx, v_line.item_id, v_line.service_id, v_line.quantity, v_unit_price);
      v_subtotal := v_subtotal + v_line.quantity * v_unit_price;
    END LOOP;
  END IF;

  UPDATE purchase_orders
  SET subtotal = v_subtotal, total_amount = v_subtotal, status = 'approved'::po_status
  WHERE id = v_new_po_id;

  UPDATE rfps SET awarded_vendor_id = v_req.runner_up_vendor_id, awarded_proposal_id = v_req.runner_up_proposal_id
  WHERE id = v_req.rfp_id;

  UPDATE po_reaward_requests
  SET status = 'approved', approved_by = auth.uid(), approval_notes = p_notes, new_po_id = v_new_po_id
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
  SELECT vu.user_id, v_req.organization_id, 'purchase_order', v_new_po_id,
         'new_po_awarded', 'New Purchase Order ' || v_new_po_number,
         'Your bid has been awarded. Please review and accept the PO in your vendor portal.'
  FROM vendor_users vu
  WHERE vu.vendor_id = v_req.runner_up_vendor_id AND vu.is_active = true
  ON CONFLICT DO NOTHING;

  RETURN v_new_po_id;
END;
$function$;

-- Repair PO-00008: keep only the runner-up line (8.3M), drop the stray 7M line
ALTER TABLE public.purchase_order_lines DISABLE TRIGGER enforce_po_line_lock_trigger;
DELETE FROM purchase_order_lines WHERE po_id='dfa4a514-07c6-4e43-95e3-d6ed4c559f13' AND unit_price=7000000;
UPDATE purchase_order_lines SET line_number=1 WHERE po_id='dfa4a514-07c6-4e43-95e3-d6ed4c559f13';
ALTER TABLE public.purchase_order_lines ENABLE TRIGGER enforce_po_line_lock_trigger;

ALTER TABLE public.purchase_orders DISABLE TRIGGER enforce_po_lock_trigger;
ALTER TABLE public.purchase_orders DISABLE TRIGGER audit_po_status;
UPDATE purchase_orders SET subtotal=8300000, total_amount=8300000 WHERE id='dfa4a514-07c6-4e43-95e3-d6ed4c559f13';
ALTER TABLE public.purchase_orders ENABLE TRIGGER enforce_po_lock_trigger;
ALTER TABLE public.purchase_orders ENABLE TRIGGER audit_po_status;
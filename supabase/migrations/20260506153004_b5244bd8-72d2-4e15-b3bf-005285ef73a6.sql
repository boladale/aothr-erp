
CREATE TABLE IF NOT EXISTS public.po_reaward_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  original_po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  rfp_id uuid REFERENCES public.rfps(id) ON DELETE SET NULL,
  runner_up_proposal_id uuid REFERENCES public.rfp_proposals(id),
  runner_up_vendor_id uuid REFERENCES public.vendors(id),
  proposed_total numeric(15,2),
  proposed_payment_terms text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected','no_runner_up')),
  requested_by uuid,
  approved_by uuid,
  approval_notes text,
  rejection_reason text,
  new_po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_reaward_org ON public.po_reaward_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_po_reaward_status ON public.po_reaward_requests(status);

ALTER TABLE public.po_reaward_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org users can view reaward requests" ON public.po_reaward_requests;
CREATE POLICY "Org users can view reaward requests"
  ON public.po_reaward_requests FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Procurement and admin can manage reaward requests" ON public.po_reaward_requests;
CREATE POLICY "Procurement and admin can manage reaward requests"
  ON public.po_reaward_requests FOR ALL TO authenticated
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_manager') OR has_role(auth.uid(),'procurement_officer')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_manager') OR has_role(auth.uid(),'procurement_officer')));

DROP TRIGGER IF EXISTS update_po_reaward_requests_updated_at ON public.po_reaward_requests;
CREATE TRIGGER update_po_reaward_requests_updated_at
  BEFORE UPDATE ON public.po_reaward_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.select_rfp_runner_up(p_rfp_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id
  FROM rfp_proposals p
  WHERE p.rfp_id = p_rfp_id
    AND p.status NOT IN ('rejected'::proposal_status,'declined'::proposal_status)
    AND p.id NOT IN (SELECT awarded_proposal_id FROM rfps WHERE id = p_rfp_id AND awarded_proposal_id IS NOT NULL)
    AND p.vendor_id NOT IN (SELECT pr.runner_up_vendor_id FROM po_reaward_requests pr WHERE pr.rfp_id = p_rfp_id AND pr.status = 'rejected' AND pr.runner_up_vendor_id IS NOT NULL)
    AND p.vendor_id NOT IN (SELECT po.vendor_id FROM purchase_orders po WHERE po.rfp_id = p_rfp_id AND po.acceptance_status = 'vendor_rejected')
  ORDER BY COALESCE(p.weighted_score, 0) DESC, p.total_amount ASC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_vendor_po_rejection()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_po record; v_runner_up_id uuid; v_runner_up record; v_user record; v_payment_terms text;
BEGIN
  IF NEW.action <> 'rejected' THEN RETURN NEW; END IF;
  SELECT * INTO v_po FROM purchase_orders WHERE id = NEW.po_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE purchase_orders
  SET status = 'cancelled'::po_status,
      acceptance_status = 'vendor_rejected',
      vendor_rejection_reason = COALESCE(NEW.notes, vendor_rejection_reason)
  WHERE id = NEW.po_id;

  FOR v_user IN
    SELECT DISTINCT ur.user_id FROM user_roles ur
    JOIN profiles pr ON pr.id = ur.user_id
    WHERE pr.organization_id = v_po.organization_id
      AND ur.role IN ('admin','procurement_manager','procurement_officer')
  LOOP
    INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
    VALUES (v_user.user_id, v_po.organization_id, 'purchase_order', v_po.id,
      'vendor_rejected_po',
      'Vendor rejected PO ' || v_po.po_number,
      'Reason: ' || COALESCE(NEW.notes, '(no reason provided)'))
    ON CONFLICT (user_id, entity_type, entity_id, notification_type) DO NOTHING;
  END LOOP;

  IF v_po.rfp_id IS NOT NULL THEN
    v_runner_up_id := public.select_rfp_runner_up(v_po.rfp_id);
    IF v_runner_up_id IS NULL THEN
      INSERT INTO po_reaward_requests (organization_id, original_po_id, rfp_id, status, requested_by)
      VALUES (v_po.organization_id, v_po.id, v_po.rfp_id, 'no_runner_up', NEW.acknowledged_by);

      FOR v_user IN
        SELECT DISTINCT ur.user_id FROM user_roles ur
        JOIN profiles pr ON pr.id = ur.user_id
        WHERE pr.organization_id = v_po.organization_id
          AND ur.role IN ('admin','procurement_manager','procurement_officer')
      LOOP
        INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
        VALUES (v_user.user_id, v_po.organization_id, 'rfp', v_po.rfp_id,
          'no_runner_up_available',
          'No runner-up bidder for PO ' || v_po.po_number,
          'Please re-open the RFP to source new bids.')
        ON CONFLICT DO NOTHING;
      END LOOP;
    ELSE
      SELECT p.*, v.name AS vendor_name
      INTO v_runner_up
      FROM rfp_proposals p JOIN vendors v ON v.id = p.vendor_id
      WHERE p.id = v_runner_up_id;

      IF jsonb_typeof(v_runner_up.payment_milestones) = 'array' AND jsonb_array_length(v_runner_up.payment_milestones) > 0 THEN
        SELECT string_agg(
          COALESCE(elem->>'description','Milestone') || ': ' ||
          CASE WHEN (elem->>'type') = 'percentage' THEN (elem->>'value') || '%' ELSE (elem->>'value') END,
          E'\n')
        INTO v_payment_terms
        FROM jsonb_array_elements(v_runner_up.payment_milestones) AS elem;
      ELSE
        SELECT payment_terms INTO v_payment_terms FROM rfps WHERE id = v_po.rfp_id;
      END IF;

      INSERT INTO po_reaward_requests (
        organization_id, original_po_id, rfp_id,
        runner_up_proposal_id, runner_up_vendor_id,
        proposed_total, proposed_payment_terms, status, requested_by
      ) VALUES (
        v_po.organization_id, v_po.id, v_po.rfp_id,
        v_runner_up_id, v_runner_up.vendor_id,
        v_runner_up.total_amount, v_payment_terms,
        'pending_approval', NEW.acknowledged_by
      );

      FOR v_user IN
        SELECT DISTINCT ur.user_id FROM user_roles ur
        JOIN profiles pr ON pr.id = ur.user_id
        WHERE pr.organization_id = v_po.organization_id
          AND ur.role IN ('admin','procurement_manager','procurement_officer')
      LOOP
        INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
        VALUES (v_user.user_id, v_po.organization_id, 'po_reaward', v_po.id,
          'reaward_pending_approval',
          'Re-award approval needed for PO ' || v_po.po_number,
          'Runner-up: ' || v_runner_up.vendor_name || ' at ' || v_runner_up.total_amount::text)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_vendor_po_rejection ON public.vendor_po_acknowledgments;
CREATE TRIGGER trg_handle_vendor_po_rejection
  AFTER INSERT ON public.vendor_po_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION public.handle_vendor_po_rejection();

CREATE OR REPLACE FUNCTION public.approve_po_reaward(p_request_id uuid, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    'Re-awarded from cancelled PO ' || v_orig.po_number,
    auth.uid(), v_req.organization_id,
    v_req.rfp_id, 'approved'::po_status, 'pending', v_orig.currency, v_orig.exchange_rate
  ) RETURNING id INTO v_new_po_id;

  IF EXISTS (SELECT 1 FROM rfp_proposal_lines WHERE proposal_id = v_proposal.id) THEN
    FOR v_line IN
      SELECT pl.unit_price, pl.quantity, ri.item_id, ri.service_id
      FROM rfp_proposal_lines pl JOIN rfp_items ri ON ri.id = pl.rfp_item_id
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

  UPDATE purchase_orders SET subtotal = v_subtotal, total_amount = v_subtotal WHERE id = v_new_po_id;

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
$$;

CREATE OR REPLACE FUNCTION public.reject_po_reaward(p_request_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_req record; v_user record;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'procurement_manager') OR has_role(auth.uid(),'procurement_officer')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  IF p_notes IS NULL OR length(btrim(p_notes)) < 5 THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  SELECT * INTO v_req FROM po_reaward_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending_approval' THEN RAISE EXCEPTION 'Request not pending'; END IF;

  UPDATE po_reaward_requests
  SET status = 'rejected', approved_by = auth.uid(), rejection_reason = p_notes
  WHERE id = p_request_id;

  FOR v_user IN
    SELECT DISTINCT ur.user_id FROM user_roles ur
    JOIN profiles pr ON pr.id = ur.user_id
    WHERE pr.organization_id = v_req.organization_id
      AND ur.role IN ('admin','procurement_manager','procurement_officer')
  LOOP
    INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
    VALUES (v_user.user_id, v_req.organization_id, 'rfp', v_req.rfp_id,
      'reaward_rejected',
      'Re-award rejected — re-open RFP',
      'Reason: ' || p_notes)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_po_reaward(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_po_reaward(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.select_rfp_runner_up(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_po_reaward(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_po_reaward(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_rfp_runner_up(uuid) TO authenticated;

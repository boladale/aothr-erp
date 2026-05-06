
-- Fix join: profiles.user_id (not profiles.id) maps to auth user / user_roles.user_id
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
    JOIN profiles pr ON pr.user_id = ur.user_id
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
        JOIN profiles pr ON pr.user_id = ur.user_id
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
        JOIN profiles pr ON pr.user_id = ur.user_id
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

-- Same fix for reject_po_reaward
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
    JOIN profiles pr ON pr.user_id = ur.user_id
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

-- Backfill notifications for past vendor rejections that were missed due to the broken join
INSERT INTO notifications (user_id, organization_id, entity_type, entity_id, notification_type, title, message)
SELECT DISTINCT ur.user_id, po.organization_id, 'purchase_order', po.id,
       'vendor_rejected_po',
       'Vendor rejected PO ' || po.po_number,
       'Reason: ' || COALESCE(ack.notes, '(no reason provided)')
FROM vendor_po_acknowledgments ack
JOIN purchase_orders po ON po.id = ack.po_id
JOIN profiles pr ON pr.organization_id = po.organization_id
JOIN user_roles ur ON ur.user_id = pr.user_id
WHERE ack.action = 'rejected'
  AND ur.role IN ('admin','procurement_manager','procurement_officer')
ON CONFLICT (user_id, entity_type, entity_id, notification_type) DO NOTHING;

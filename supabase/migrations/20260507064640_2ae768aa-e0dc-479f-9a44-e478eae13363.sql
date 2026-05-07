CREATE OR REPLACE FUNCTION public.handle_vendor_po_rejection()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_po record; v_runner_up_id uuid; v_runner_up record; v_user record; v_payment_terms text;
BEGIN
  IF NEW.action <> 'rejected' THEN RETURN NEW; END IF;
  SELECT * INTO v_po FROM purchase_orders WHERE id = NEW.po_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE purchase_orders
  SET status = 'rejected'::po_status,
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
$function$;
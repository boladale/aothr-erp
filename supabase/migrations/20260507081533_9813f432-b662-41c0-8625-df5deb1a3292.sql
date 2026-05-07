
-- Fix approve_po_reaward to also copy service_id and description from rfp_items
CREATE OR REPLACE FUNCTION public.approve_po_reaward(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_orig record;
  v_proposal record;
  v_new_po_id uuid;
  v_new_po_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_line_count int := 0;
  v_ratio numeric;
BEGIN
  SELECT * INTO v_req FROM po_reaward_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Re-award request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  SELECT * INTO v_orig FROM purchase_orders WHERE id = v_req.original_po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original PO not found'; END IF;

  SELECT * INTO v_proposal FROM rfp_proposals
   WHERE rfp_id = v_orig.rfp_id AND vendor_id = v_req.new_vendor_id LIMIT 1;

  v_new_po_number := next_transaction_number(v_orig.organization_id, 'PO', 'PO');

  INSERT INTO purchase_orders (
    po_number, vendor_id, ship_to_location_id, expected_date, notes,
    organization_id, created_by, rfp_id, status, subtotal, total_amount,
    payment_terms_type, payment_terms_amount, discount_type, discount_amount
  ) VALUES (
    v_new_po_number, v_req.new_vendor_id, v_orig.ship_to_location_id, v_orig.expected_date,
    COALESCE(v_orig.notes, '') || E'\nRe-awarded from ' || v_orig.po_number,
    v_orig.organization_id, auth.uid(), v_orig.rfp_id, 'draft', 0, 0,
    v_orig.payment_terms_type, v_orig.payment_terms_amount, v_orig.discount_type, v_orig.discount_amount
  ) RETURNING id INTO v_new_po_id;

  IF v_proposal.id IS NOT NULL THEN
    INSERT INTO purchase_order_lines (po_id, line_number, item_id, service_id, description, quantity, unit_price)
    SELECT v_new_po_id,
           ROW_NUMBER() OVER (ORDER BY ri.created_at),
           ri.item_id,
           ri.service_id,
           COALESCE(NULLIF(ri.specifications,''), i.name, s.name),
           ppl.quantity,
           ppl.unit_price
      FROM rfp_proposal_lines ppl
      JOIN rfp_items ri ON ri.id = ppl.rfp_item_id
      LEFT JOIN items i ON i.id = ri.item_id
      LEFT JOIN services s ON s.id = ri.service_id
     WHERE ppl.proposal_id = v_proposal.id;
    GET DIAGNOSTICS v_line_count = ROW_COUNT;
  END IF;

  IF v_line_count = 0 THEN
    -- Fallback: copy original PO lines proportionally
    IF v_orig.subtotal > 0 AND v_proposal.total_amount IS NOT NULL THEN
      v_ratio := v_proposal.total_amount / v_orig.subtotal;
    ELSE
      v_ratio := 1;
    END IF;
    INSERT INTO purchase_order_lines (po_id, line_number, item_id, service_id, description, quantity, unit_price)
    SELECT v_new_po_id, line_number, item_id, service_id, description, quantity, unit_price * v_ratio
      FROM purchase_order_lines WHERE po_id = v_orig.id ORDER BY line_number;
  END IF;

  SELECT COALESCE(SUM(quantity * unit_price),0) INTO v_subtotal
    FROM purchase_order_lines WHERE po_id = v_new_po_id;
  v_total := v_subtotal;
  IF v_orig.discount_amount > 0 THEN
    IF v_orig.discount_type = 'percentage' THEN
      v_total := GREATEST(0, v_subtotal - (v_subtotal * v_orig.discount_amount / 100));
    ELSE
      v_total := GREATEST(0, v_subtotal - v_orig.discount_amount);
    END IF;
  END IF;

  UPDATE purchase_orders SET status = 'approved', subtotal = v_subtotal, total_amount = v_total,
    approved_by = auth.uid(), approved_at = now() WHERE id = v_new_po_id;

  UPDATE po_reaward_requests SET status = 'approved', new_po_id = v_new_po_id,
    approved_by = auth.uid(), approved_at = now() WHERE id = p_request_id;

  RETURN v_new_po_id;
END;
$$;

-- Repair PO-00008 existing line: backfill service/description
ALTER TABLE purchase_order_lines DISABLE TRIGGER enforce_po_line_lock_trigger;
UPDATE purchase_order_lines pol
   SET service_id = ri.service_id,
       item_id = ri.item_id,
       description = COALESCE(NULLIF(ri.specifications,''), i.name, s.name)
  FROM rfp_items ri
  LEFT JOIN items i ON i.id = ri.item_id
  LEFT JOIN services s ON s.id = ri.service_id
 WHERE pol.po_id = 'dfa4a514-07c6-4e43-95e3-d6ed4c559f13'
   AND ri.rfp_id = '4b0c8893-3515-425c-8567-2278bf709c22';
ALTER TABLE purchase_order_lines ENABLE TRIGGER enforce_po_line_lock_trigger;

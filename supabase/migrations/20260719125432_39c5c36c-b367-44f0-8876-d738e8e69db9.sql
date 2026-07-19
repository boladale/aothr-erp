
-- 1) Relax PO requirement on AP invoices to allow opening-balance carry-ins
ALTER TABLE public.ap_invoices ALTER COLUMN po_id DROP NOT NULL;

-- 2) Opening-balance markers
ALTER TABLE public.ap_invoices           ADD COLUMN IF NOT EXISTS is_opening_balance boolean NOT NULL DEFAULT false;
ALTER TABLE public.ar_invoices           ADD COLUMN IF NOT EXISTS is_opening_balance boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_adjustments ADD COLUMN IF NOT EXISTS is_opening_balance boolean NOT NULL DEFAULT false;
ALTER TABLE public.fixed_assets          ADD COLUMN IF NOT EXISTS is_opening_balance boolean NOT NULL DEFAULT false;

-- 3) RPC: post the opening trial balance as ONE balanced JE
-- _lines: [{"account_id":"uuid","debit":number,"credit":number,"description":"text"}, ...]
CREATE OR REPLACE FUNCTION public.post_opening_trial_balance(_cutover date, _lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_entry_id uuid;
  v_entry_number text;
  v_period_id uuid;
  v_je_date date := (_cutover - INTERVAL '1 day')::date;
  v_line jsonb;
  v_line_num int := 0;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can post opening balances';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No organization context';
  END IF;
  IF jsonb_array_length(_lines) < 2 THEN
    RAISE EXCEPTION 'Trial balance requires at least two lines';
  END IF;

  -- Totals check
  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_total_debit  := v_total_debit  + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;
  IF round(v_total_debit,2) <> round(v_total_credit,2) THEN
    RAISE EXCEPTION 'Trial balance is not balanced (DR=%, CR=%)', v_total_debit, v_total_credit;
  END IF;

  -- Ensure fiscal period exists & OPEN on the JE date (or bail with a clear error)
  SELECT id INTO v_period_id
  FROM public.gl_fiscal_periods
  WHERE organization_id = v_org
    AND v_je_date BETWEEN start_date AND end_date
    AND status = 'open'
  LIMIT 1;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No OPEN fiscal period covers % — create/reopen the period first', v_je_date;
  END IF;

  v_entry_number := public.next_transaction_number('journal_entry', 'JE');

  INSERT INTO public.gl_journal_entries (
    entry_number, entry_date, description, status, total_debit, total_credit,
    fiscal_period_id, posted_at, posted_by, created_by, organization_id
  ) VALUES (
    v_entry_number, v_je_date, 'Opening Trial Balance (Cutover ' || _cutover || ')',
    'posted', v_total_debit, v_total_credit, v_period_id, now(), auth.uid(), auth.uid(), v_org
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_line_num := v_line_num + 1;
    v_debit  := COALESCE((v_line->>'debit')::numeric, 0);
    v_credit := COALESCE((v_line->>'credit')::numeric, 0);
    IF v_debit = 0 AND v_credit = 0 THEN CONTINUE; END IF;
    INSERT INTO public.gl_journal_lines (
      journal_entry_id, line_number, account_id, description, debit, credit, organization_id
    ) VALUES (
      v_entry_id, v_line_num, (v_line->>'account_id')::uuid,
      COALESCE(v_line->>'description','Opening balance'),
      v_debit, v_credit, v_org
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$;

-- 4) Bulk import opening AP invoices (no GL posting — TB already reflects AP control)
-- _rows: [{"vendor_id":"uuid","invoice_number":"text","invoice_date":"date","due_date":"date","total_amount":number}, ...]
CREATE OR REPLACE FUNCTION public.import_opening_ap_invoices(_rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_row jsonb;
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import opening balances';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.ap_invoices (
      invoice_number, vendor_id, po_id, invoice_date, due_date,
      subtotal, tax_amount, total_amount, status,
      posted_at, posted_by, created_by, organization_id,
      source, is_opening_balance
    ) VALUES (
      v_row->>'invoice_number',
      (v_row->>'vendor_id')::uuid,
      NULL,
      COALESCE((v_row->>'invoice_date')::date, CURRENT_DATE),
      NULLIF(v_row->>'due_date','')::date,
      COALESCE((v_row->>'total_amount')::numeric, 0),
      0,
      COALESCE((v_row->>'total_amount')::numeric, 0),
      'posted',
      now(), auth.uid(), auth.uid(), v_org,
      'opening_balance', true
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 5) Bulk import opening AR invoices
CREATE OR REPLACE FUNCTION public.import_opening_ar_invoices(_rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_row jsonb;
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import opening balances';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.ar_invoices (
      invoice_number, customer_id, invoice_date, due_date,
      status, payment_status, subtotal, tax_amount, total_amount,
      posted_at, posted_by, created_by, organization_id, is_opening_balance
    ) VALUES (
      v_row->>'invoice_number',
      (v_row->>'customer_id')::uuid,
      COALESCE((v_row->>'invoice_date')::date, CURRENT_DATE),
      NULLIF(v_row->>'due_date','')::date,
      'posted'::ar_invoice_status, 'unpaid'::ar_payment_status,
      COALESCE((v_row->>'total_amount')::numeric, 0),
      0,
      COALESCE((v_row->>'total_amount')::numeric, 0),
      now(), auth.uid(), auth.uid(), v_org, true
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 6) Bulk import opening inventory — sets balances + creates FIFO layers, no GL (TB has it)
-- _rows: [{"item_id":"uuid","location_id":"uuid","quantity":number,"unit_cost":number}, ...]
CREATE OR REPLACE FUNCTION public.import_opening_inventory(_cutover date, _rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_row jsonb;
  v_count int := 0;
  v_item uuid;
  v_loc uuid;
  v_qty numeric;
  v_cost numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import opening balances';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    v_item := (v_row->>'item_id')::uuid;
    v_loc  := (v_row->>'location_id')::uuid;
    v_qty  := COALESCE((v_row->>'quantity')::numeric, 0);
    v_cost := COALESCE((v_row->>'unit_cost')::numeric, 0);
    IF v_qty <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.inventory_balances (item_id, location_id, quantity, organization_id)
    VALUES (v_item, v_loc, v_qty, v_org)
    ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, last_updated = now();

    INSERT INTO public.inventory_costing_layers (
      item_id, location_id, source_type, source_id, receipt_date,
      original_qty, remaining_qty, unit_cost, organization_id
    ) VALUES (
      v_item, v_loc, 'opening_balance', NULL, (_cutover - INTERVAL '1 day')::date,
      v_qty, v_qty, v_cost, v_org
    );

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 7) Bulk import opening fixed assets (register only, GL is in TB)
-- _rows: [{"asset_code":"text","name":"text","category_id":"uuid","location_id":"uuid","department_id":"uuid","acquisition_date":"date","acquisition_cost":number,"salvage_value":number,"useful_life_years":int,"depreciation_method":"straight_line|reducing_balance","accumulated_depreciation":number}, ...]
CREATE OR REPLACE FUNCTION public.import_opening_fixed_assets(_cutover date, _rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_row jsonb;
  v_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import opening balances';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.fixed_assets (
      organization_id, asset_code, name, category_id, location_id, department_id,
      acquisition_date, acquisition_cost, salvage_value, useful_life_years,
      depreciation_method, accumulated_depreciation, last_depreciation_date,
      status, created_by, is_opening_balance
    ) VALUES (
      v_org,
      v_row->>'asset_code',
      v_row->>'name',
      NULLIF(v_row->>'category_id','')::uuid,
      NULLIF(v_row->>'location_id','')::uuid,
      NULLIF(v_row->>'department_id','')::uuid,
      COALESCE((v_row->>'acquisition_date')::date, (_cutover - INTERVAL '1 day')::date),
      COALESCE((v_row->>'acquisition_cost')::numeric, 0),
      COALESCE((v_row->>'salvage_value')::numeric, 0),
      COALESCE((v_row->>'useful_life_years')::int, 5),
      COALESCE(v_row->>'depreciation_method', 'straight_line'),
      COALESCE((v_row->>'accumulated_depreciation')::numeric, 0),
      (_cutover - INTERVAL '1 day')::date,
      'active', auth.uid(), true
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 8) Lock all fiscal periods ending before the cutover
CREATE OR REPLACE FUNCTION public.lock_pre_cutover_periods(_cutover date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
  v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can lock periods';
  END IF;
  UPDATE public.gl_fiscal_periods
  SET status = 'closed'
  WHERE organization_id = v_org
    AND end_date < _cutover
    AND status = 'open';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.post_opening_trial_balance(date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.import_opening_ap_invoices(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.import_opening_ar_invoices(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.import_opening_inventory(date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.import_opening_fixed_assets(date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.lock_pre_cutover_periods(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.post_opening_trial_balance(date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_opening_ap_invoices(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_opening_ar_invoices(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_opening_inventory(date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_opening_fixed_assets(date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_pre_cutover_periods(date) TO authenticated;

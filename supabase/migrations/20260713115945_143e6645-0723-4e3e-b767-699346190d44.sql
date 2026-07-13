CREATE OR REPLACE FUNCTION public.post_asset_depreciation(p_asset_id uuid, p_period_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_asset public.fixed_assets%ROWTYPE;
  v_cat public.fixed_asset_categories%ROWTYPE;
  v_monthly NUMERIC(18,2);
  v_nbv NUMERIC(18,2);
  v_je_id UUID;
  v_entry_no TEXT;
  v_org UUID;
  v_expense_acct UUID;
  v_accum_acct UUID;
  v_period_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id;
  IF NOT FOUND OR v_asset.status <> 'active' THEN
    RAISE EXCEPTION 'Asset not found or not active';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.fixed_asset_depreciation
    WHERE asset_id = p_asset_id
      AND EXTRACT(YEAR FROM period_date) = EXTRACT(YEAR FROM p_period_date)
      AND EXTRACT(MONTH FROM period_date) = EXTRACT(MONTH FROM p_period_date)
  ) INTO v_exists;
  IF v_exists THEN
    RAISE EXCEPTION 'Depreciation already posted for % for %', v_asset.asset_code, to_char(p_period_date,'Mon YYYY');
  END IF;

  SELECT * INTO v_cat FROM public.fixed_asset_categories WHERE id = v_asset.category_id;

  v_nbv := v_asset.acquisition_cost - v_asset.accumulated_depreciation;
  IF v_nbv <= v_asset.salvage_value THEN
    RAISE EXCEPTION 'Asset fully depreciated';
  END IF;

  IF v_asset.depreciation_method = 'reducing_balance' THEN
    v_monthly := ROUND((v_nbv * COALESCE(v_asset.depreciation_rate, v_cat.depreciation_rate, 0) / 100.0) / 12.0, 2);
  ELSE
    v_monthly := ROUND(((v_asset.acquisition_cost - v_asset.salvage_value) / NULLIF(v_asset.useful_life_years,0)) / 12.0, 2);
  END IF;

  IF (v_asset.accumulated_depreciation + v_monthly) > (v_asset.acquisition_cost - v_asset.salvage_value) THEN
    v_monthly := (v_asset.acquisition_cost - v_asset.salvage_value) - v_asset.accumulated_depreciation;
  END IF;

  IF v_monthly <= 0 THEN
    RAISE EXCEPTION 'Nothing to depreciate';
  END IF;

  v_org := v_asset.organization_id;
  v_expense_acct := v_cat.depr_expense_gl_account_id;
  v_accum_acct := v_cat.accum_depr_gl_account_id;
  IF v_expense_acct IS NULL OR v_accum_acct IS NULL THEN
    RAISE EXCEPTION 'Category is missing depreciation GL accounts';
  END IF;

  SELECT id INTO v_period_id FROM public.gl_fiscal_periods
    WHERE organization_id = v_org AND p_period_date BETWEEN start_date AND end_date AND status = 'open'
    LIMIT 1;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal period for %', p_period_date;
  END IF;

  v_entry_no := 'JE/DEP/' || to_char(p_period_date,'YYYYMM') || '/' || substr(p_asset_id::text,1,6);

  INSERT INTO public.gl_journal_entries(organization_id, entry_number, entry_date, description, status, source_module, source_id, fiscal_period_id, posted_at)
  VALUES (v_org, v_entry_no, p_period_date, 'Depreciation - ' || v_asset.name, 'posted', 'fixed_assets', p_asset_id, v_period_id, now())
  RETURNING id INTO v_je_id;

  INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_je_id, v_expense_acct, v_monthly, 0, 'Depreciation expense - ' || v_asset.asset_code),
    (v_je_id, v_accum_acct, 0, v_monthly, 'Accum. depreciation - ' || v_asset.asset_code);

  UPDATE public.fixed_assets
     SET accumulated_depreciation = accumulated_depreciation + v_monthly,
         last_depreciation_date = p_period_date
   WHERE id = p_asset_id;

  INSERT INTO public.fixed_asset_depreciation(organization_id, asset_id, period_date, depreciation_amount, nbv_after, journal_entry_id, posted, posted_at, posted_by)
  VALUES (v_org, p_asset_id, p_period_date, v_monthly, v_asset.acquisition_cost - (v_asset.accumulated_depreciation + v_monthly), v_je_id, true, now(), auth.uid());

  RETURN v_je_id;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fixed_asset_depr_asset_ym
  ON public.fixed_asset_depreciation (asset_id, (EXTRACT(YEAR FROM period_date)), (EXTRACT(MONTH FROM period_date)));

-- Fixed Assets Module

CREATE TABLE IF NOT EXISTS public.fixed_asset_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line', -- straight_line | reducing_balance
  depreciation_rate NUMERIC(6,3) DEFAULT 0, -- used for reducing_balance
  asset_gl_account_id UUID REFERENCES public.gl_accounts(id),
  accum_depr_gl_account_id UUID REFERENCES public.gl_accounts(id),
  depr_expense_gl_account_id UUID REFERENCES public.gl_accounts(id),
  disposal_gain_gl_account_id UUID REFERENCES public.gl_accounts(id),
  disposal_loss_gl_account_id UUID REFERENCES public.gl_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_asset_categories TO authenticated;
GRANT ALL ON public.fixed_asset_categories TO service_role;
ALTER TABLE public.fixed_asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage fa categories" ON public.fixed_asset_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.fixed_asset_categories(id),
  location_id UUID REFERENCES public.locations(id),
  custodian TEXT,
  serial_number TEXT,
  acquisition_date DATE NOT NULL,
  acquisition_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  salvage_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  depreciation_rate NUMERIC(6,3) DEFAULT 0,
  accumulated_depreciation NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_depreciation_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active | disposed | written_off
  disposal_date DATE,
  disposal_proceeds NUMERIC(18,2),
  disposal_notes TEXT,
  po_id UUID,
  invoice_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, asset_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage fixed assets" ON public.fixed_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_date DATE NOT NULL, -- last day of the period
  depreciation_amount NUMERIC(18,2) NOT NULL,
  nbv_after NUMERIC(18,2) NOT NULL,
  journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
  posted BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, period_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_asset_depreciation TO authenticated;
GRANT ALL ON public.fixed_asset_depreciation TO service_role;
ALTER TABLE public.fixed_asset_depreciation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage fa depreciation" ON public.fixed_asset_depreciation FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fa_org ON public.fixed_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_fa_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fa_depr_asset ON public.fixed_asset_depreciation(asset_id);

-- updated_at triggers
CREATE TRIGGER trg_fa_categories_upd BEFORE UPDATE ON public.fixed_asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fa_upd BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: post monthly depreciation for a single asset on a given period-end date
CREATE OR REPLACE FUNCTION public.post_asset_depreciation(p_asset_id UUID, p_period_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id;
  IF NOT FOUND OR v_asset.status <> 'active' THEN
    RAISE EXCEPTION 'Asset not found or not active';
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

  -- clamp to remaining depreciable amount
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
$$;

-- Function: dispose an asset
CREATE OR REPLACE FUNCTION public.dispose_fixed_asset(p_asset_id UUID, p_disposal_date DATE, p_proceeds NUMERIC, p_cash_account_id UUID, p_notes TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset public.fixed_assets%ROWTYPE;
  v_cat public.fixed_asset_categories%ROWTYPE;
  v_nbv NUMERIC(18,2);
  v_gain_loss NUMERIC(18,2);
  v_je_id UUID;
  v_period_id UUID;
  v_entry_no TEXT;
BEGIN
  SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id;
  IF NOT FOUND OR v_asset.status <> 'active' THEN RAISE EXCEPTION 'Asset not active'; END IF;
  SELECT * INTO v_cat FROM public.fixed_asset_categories WHERE id = v_asset.category_id;

  v_nbv := v_asset.acquisition_cost - v_asset.accumulated_depreciation;
  v_gain_loss := COALESCE(p_proceeds,0) - v_nbv; -- positive=gain, negative=loss

  SELECT id INTO v_period_id FROM public.gl_fiscal_periods
    WHERE organization_id = v_asset.organization_id AND p_disposal_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'No open fiscal period'; END IF;

  v_entry_no := 'JE/DISP/' || to_char(p_disposal_date,'YYYYMMDD') || '/' || substr(p_asset_id::text,1,6);

  INSERT INTO public.gl_journal_entries(organization_id, entry_number, entry_date, description, status, source_module, source_id, fiscal_period_id, posted_at)
  VALUES (v_asset.organization_id, v_entry_no, p_disposal_date, 'Disposal - ' || v_asset.name, 'posted', 'fixed_assets', p_asset_id, v_period_id, now())
  RETURNING id INTO v_je_id;

  -- DR Cash proceeds, DR Accum Depr, CR Asset cost, plus gain (CR) or loss (DR)
  IF COALESCE(p_proceeds,0) > 0 AND p_cash_account_id IS NOT NULL THEN
    INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, p_cash_account_id, p_proceeds, 0, 'Disposal proceeds - ' || v_asset.asset_code);
  END IF;
  INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, v_cat.accum_depr_gl_account_id, v_asset.accumulated_depreciation, 0, 'Reverse accum. depr - ' || v_asset.asset_code);
  INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
  VALUES (v_je_id, v_cat.asset_gl_account_id, 0, v_asset.acquisition_cost, 'Remove asset cost - ' || v_asset.asset_code);

  IF v_gain_loss > 0 AND v_cat.disposal_gain_gl_account_id IS NOT NULL THEN
    INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_cat.disposal_gain_gl_account_id, 0, v_gain_loss, 'Gain on disposal');
  ELSIF v_gain_loss < 0 AND v_cat.disposal_loss_gl_account_id IS NOT NULL THEN
    INSERT INTO public.gl_journal_lines(journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_cat.disposal_loss_gl_account_id, ABS(v_gain_loss), 0, 'Loss on disposal');
  END IF;

  UPDATE public.fixed_assets
     SET status = 'disposed', disposal_date = p_disposal_date, disposal_proceeds = p_proceeds, disposal_notes = p_notes
   WHERE id = p_asset_id;

  RETURN v_je_id;
END;
$$;

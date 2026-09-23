CREATE TABLE public.gl_recurring_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  next_run_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_recurring_entries TO authenticated;
GRANT ALL ON public.gl_recurring_entries TO service_role;
ALTER TABLE public.gl_recurring_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage recurring entries" ON public.gl_recurring_entries FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id()) WITH CHECK (organization_id = public.get_user_org_id());
CREATE TRIGGER set_org_recurring BEFORE INSERT ON public.gl_recurring_entries FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.gl_recurring_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_entry_id uuid NOT NULL REFERENCES public.gl_recurring_entries(id) ON DELETE CASCADE,
  line_number int NOT NULL DEFAULT 1,
  account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_recurring_entry_lines TO authenticated;
GRANT ALL ON public.gl_recurring_entry_lines TO service_role;
ALTER TABLE public.gl_recurring_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage recurring lines" ON public.gl_recurring_entry_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gl_recurring_entries r WHERE r.id = recurring_entry_id AND r.organization_id = public.get_user_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gl_recurring_entries r WHERE r.id = recurring_entry_id AND r.organization_id = public.get_user_org_id()));

CREATE OR REPLACE FUNCTION public.generate_recurring_entry(p_recurring_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_je uuid; v_dr numeric; v_cr numeric; v_next date;
BEGIN
  SELECT * INTO r FROM gl_recurring_entries WHERE id = p_recurring_id AND organization_id = get_user_org_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recurring entry not found'; END IF;
  IF NOT r.is_active THEN RAISE EXCEPTION 'Recurring entry is paused'; END IF;
  IF r.end_date IS NOT NULL AND r.next_run_date > r.end_date THEN RAISE EXCEPTION 'Recurring entry has passed its end date'; END IF;
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_dr, v_cr FROM gl_recurring_entry_lines WHERE recurring_entry_id = r.id;
  IF v_dr = 0 OR v_dr <> v_cr THEN RAISE EXCEPTION 'Recurring entry lines are not balanced'; END IF;

  INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, status, created_by, organization_id, total_debit, total_credit)
  VALUES ('REC-' || upper(substr(r.id::text,1,6)) || '-' || to_char(r.next_run_date,'YYYYMMDD') || '-' || substr(md5(random()::text),1,4),
          r.next_run_date, 'Recurring: ' || r.name, 'recurring', r.id, 'draft', auth.uid(), r.organization_id, v_dr, v_cr)
  RETURNING id INTO v_je;

  INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
  SELECT v_je, line_number, account_id, debit, credit, COALESCE(description, r.name)
  FROM gl_recurring_entry_lines WHERE recurring_entry_id = r.id;

  UPDATE gl_journal_entries SET status = 'posted', posted_at = now(), posted_by = auth.uid() WHERE id = v_je;

  v_next := CASE r.frequency WHEN 'weekly' THEN r.next_run_date + 7
    WHEN 'quarterly' THEN (r.next_run_date + interval '3 months')::date
    WHEN 'yearly' THEN (r.next_run_date + interval '1 year')::date
    ELSE (r.next_run_date + interval '1 month')::date END;
  UPDATE gl_recurring_entries SET next_run_date = v_next, last_generated_at = now(), updated_at = now(),
    is_active = CASE WHEN end_date IS NOT NULL AND v_next > end_date THEN false ELSE is_active END
  WHERE id = r.id;
  RETURN v_je;
END; $$;
GRANT EXECUTE ON FUNCTION public.generate_recurring_entry(uuid) TO authenticated;
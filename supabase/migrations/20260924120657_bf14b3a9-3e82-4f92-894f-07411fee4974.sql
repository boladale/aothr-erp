
-- ============ AI SETTINGS ============
CREATE TABLE public.ai_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  chat_enabled boolean NOT NULL DEFAULT true,
  insights_enabled boolean NOT NULL DEFAULT true,
  alerts_enabled boolean NOT NULL DEFAULT true,
  automation_enabled boolean NOT NULL DEFAULT false,
  actions_enabled boolean NOT NULL DEFAULT false,
  morning_brief_enabled boolean NOT NULL DEFAULT true,
  ai_provider text NOT NULL DEFAULT 'openai',
  ai_model text NOT NULL DEFAULT 'gpt-4o-mini',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read AI settings" ON public.ai_settings FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id());
CREATE POLICY "Admins insert AI settings" ON public.ai_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update AI settings" ON public.ai_settings FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.ai_settings_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER trg_ai_settings_touch BEFORE UPDATE ON public.ai_settings FOR EACH ROW EXECUTE FUNCTION public.ai_settings_touch();

INSERT INTO public.ai_settings(organization_id) SELECT id FROM public.organizations ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.ai_settings_for_new_org() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO public.ai_settings(organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER trg_ai_settings_new_org AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.ai_settings_for_new_org();

-- ============ GUARDS ============
CREATE OR REPLACE FUNCTION public.ai_can(p_code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executive') OR public.has_permission(p_code);
$$;

-- returns org id or raises. p_codes: any one of the listed permissions is enough
CREATE OR REPLACE FUNCTION public.ai_guard(p_codes text[]) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid; v_on boolean; c text; ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AI_NOT_SIGNED_IN'; END IF;
  v_org := public.get_user_org_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'AI_NO_COMPANY'; END IF;
  SELECT ai_enabled INTO v_on FROM public.ai_settings WHERE organization_id = v_org;
  IF NOT coalesce(v_on,false) THEN RAISE EXCEPTION 'AI_DISABLED'; END IF;
  FOREACH c IN ARRAY p_codes LOOP IF public.ai_can(c) THEN ok := true; EXIT; END IF; END LOOP;
  IF NOT ok THEN RAISE EXCEPTION 'AI_NOT_PERMITTED'; END IF;
  RETURN v_org;
END $$;

-- ============ SHARED ACCOUNTING LOGIC (same rules as Financial Reports) ============
CREATE OR REPLACE FUNCTION public.ai_account_balances(p_org uuid, p_from date, p_to date)
RETURNS TABLE(account_id uuid, account_code text, account_name text, account_type text, debit numeric, credit numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.id, a.account_code, a.account_name, a.account_type::text,
    coalesce(sum(l.debit),0), coalesce(sum(l.credit),0),
    CASE WHEN coalesce(a.normal_balance, CASE WHEN a.account_type::text IN ('asset','expense') THEN 'debit' ELSE 'credit' END)='debit'
      THEN coalesce(sum(l.debit),0)-coalesce(sum(l.credit),0) ELSE coalesce(sum(l.credit),0)-coalesce(sum(l.debit),0) END
  FROM gl_accounts a
  LEFT JOIN gl_journal_lines l ON l.account_id=a.id AND EXISTS (
    SELECT 1 FROM gl_journal_entries e WHERE e.id=l.journal_entry_id AND e.status='posted'
      AND e.organization_id=p_org AND (p_from IS NULL OR e.entry_date>=p_from) AND (p_to IS NULL OR e.entry_date<=p_to))
  WHERE a.organization_id=p_org AND a.is_active
  GROUP BY a.id;
$$;

CREATE OR REPLACE FUNCTION public.ai_pl_totals(p_org uuid, p_from date, p_to date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH b AS (SELECT * FROM public.ai_account_balances(p_org,p_from,p_to)),
  t AS (SELECT
    coalesce(sum(balance) FILTER (WHERE account_type='revenue'),0) rev,
    coalesce(sum(balance) FILTER (WHERE account_type='expense' AND (account_code LIKE '51%' OR account_name ILIKE '%cost of%')),0) cos,
    coalesce(sum(balance) FILTER (WHERE account_type='expense' AND NOT (account_code LIKE '51%' OR account_name ILIKE '%cost of%')),0) opex
    FROM b)
  SELECT jsonb_build_object('revenue',rev,'cost_of_sales',cos,'gross_profit',rev-cos,
    'gross_margin_pct',CASE WHEN rev<>0 THEN round((rev-cos)/rev*100,1) END,
    'operating_expenses',opex,'net_profit',rev-cos-opex,
    'net_margin_pct',CASE WHEN rev<>0 THEN round((rev-cos-opex)/rev*100,1) END) FROM t;
$$;

CREATE OR REPLACE FUNCTION public.ai_journal_last_change(p_org uuid) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT max(greatest(coalesce(posted_at,created_at),updated_at)) FROM gl_journal_entries WHERE organization_id=p_org;
$$;

-- ============ 2. PROFIT & LOSS MONTHLY ============
CREATE OR REPLACE FUNCTION public.ai_profit_loss_monthly() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['financial_reports','finance_dashboard']);
  y int := extract(year FROM current_date)::int; r jsonb;
BEGIN
  WITH m AS (
    SELECT date_trunc('month',e.entry_date)::date mon, a.account_type::text t,
      (a.account_code LIKE '51%' OR a.account_name ILIKE '%cost of%') is_cos,
      sum(CASE WHEN a.account_type::text='revenue' THEN l.credit-l.debit ELSE l.debit-l.credit END) amt
    FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id JOIN gl_accounts a ON a.id=l.account_id
    WHERE e.organization_id=v_org AND e.status='posted' AND a.account_type::text IN ('revenue','expense')
      AND e.entry_date >= make_date(y-1,1,1)
    GROUP BY 1,2,3),
  agg AS (SELECT mon,
    coalesce(sum(amt) FILTER (WHERE t='revenue'),0) rev,
    coalesce(sum(amt) FILTER (WHERE t='expense' AND is_cos),0) cos,
    coalesce(sum(amt) FILTER (WHERE t='expense' AND NOT is_cos),0) opex FROM m GROUP BY mon)
  SELECT coalesce(jsonb_agg(jsonb_build_object('month',to_char(mon,'YYYY-MM'),'revenue',rev,'cost_of_sales',cos,
    'gross_profit',rev-cos,'gross_margin_pct',CASE WHEN rev<>0 THEN round((rev-cos)/rev*100,1) END,
    'operating_expenses',opex,'net_profit',rev-cos-opex) ORDER BY mon),'[]') INTO r FROM agg;
  RETURN jsonb_build_object('summary','profit_loss_monthly','currency','NGN',
    'ytd',public.ai_pl_totals(v_org,make_date(y,1,1),current_date),
    'last_year_same_period',public.ai_pl_totals(v_org,make_date(y-1,1,1),(current_date - interval '1 year')::date),
    'last_year_full',public.ai_pl_totals(v_org,make_date(y-1,1,1),make_date(y-1,12,31)),
    'months',r,'source','posted journals (same rules as Financial Reports)',
    'as_of',now(),'source_last_changed_at',public.ai_journal_last_change(v_org));
END $$;

-- ============ 3. CASH ============
CREATE OR REPLACE FUNCTION public.ai_cash_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['bank_accounts','cash_dashboard','cash_reports','financial_reports']); r jsonb;
BEGIN
  WITH lb AS (SELECT * FROM public.ai_account_balances(v_org,NULL,NULL)),
  x AS (SELECT b.account_name, b.bank_name, b.account_type, b.currency,
      lb.balance ledger_balance, b.current_balance book_balance
    FROM bank_accounts b LEFT JOIN lb ON lb.account_id=b.gl_account_id
    WHERE b.organization_id=v_org AND b.is_active)
  SELECT jsonb_build_object('summary','cash_position','currency','NGN',
    'total_cash_ledger',coalesce(sum(ledger_balance),0),'total_cash_book',coalesce(sum(book_balance),0),
    'accounts',coalesce(jsonb_agg(jsonb_build_object('account',account_name,'bank',bank_name,'type',account_type,'currency',currency,
      'ledger_balance',ledger_balance,'book_balance',book_balance,'difference',coalesce(book_balance,0)-coalesce(ledger_balance,0))),'[]'),
    'note','ledger_balance comes from posted journals and is authoritative',
    'as_of',now(),'source_last_changed_at',public.ai_journal_last_change(v_org)) INTO r FROM x;
  RETURN r;
END $$;

-- ============ 4/5. RECEIVABLES & PAYABLES ============
CREATE OR REPLACE FUNCTION public.ai_receivables() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['ar_aging','ar_reports','ar_invoices']); r jsonb;
BEGIN
  WITH o AS (SELECT i.customer_id, i.due_date, i.total_amount - coalesce((SELECT sum(allocated_amount) FROM ar_receipt_allocations a WHERE a.invoice_id=i.id),0) bal
      FROM ar_invoices i WHERE i.organization_id=v_org AND i.status='posted' AND i.payment_status<>'paid'),
  o2 AS (SELECT *, CASE WHEN due_date IS NULL OR due_date>=current_date THEN 0 ELSE current_date-due_date END od FROM o WHERE bal>0.005),
  top AS (SELECT c.name, c.code, sum(bal) owed, sum(bal) FILTER (WHERE od>0) overdue, max(od) max_days
      FROM o2 JOIN customers c ON c.id=o2.customer_id GROUP BY c.name,c.code ORDER BY 3 DESC LIMIT 10)
  SELECT jsonb_build_object('summary','receivables','currency','NGN',
    'total_owed',(SELECT coalesce(sum(bal),0) FROM o2),'open_invoices',(SELECT count(*) FROM o2),
    'current',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od=0),
    'd1_30',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 1 AND 30),
    'd31_60',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 31 AND 60),
    'd61_90',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 61 AND 90),
    'd90_plus',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od>90),
    'overdue_total',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od>0),
    'top_customers',(SELECT coalesce(jsonb_agg(to_jsonb(top)),'[]') FROM top),
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM ar_invoices WHERE organization_id=v_org)) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ai_payables() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['ap_aging','ap_reports','invoices','ap_payments']); r jsonb;
BEGIN
  WITH o AS (SELECT i.vendor_id, i.due_date, i.total_amount - coalesce((SELECT sum(allocated_amount) FROM ap_payment_allocations a WHERE a.invoice_id=i.id),0) bal
      FROM ap_invoices i WHERE i.organization_id=v_org AND i.status='posted' AND coalesce(i.payment_status,'unpaid')<>'paid'),
  o2 AS (SELECT *, CASE WHEN due_date IS NULL OR due_date>=current_date THEN 0 ELSE current_date-due_date END od FROM o WHERE bal>0.005),
  top AS (SELECT v.name, v.code, sum(bal) owed, sum(bal) FILTER (WHERE od>0) overdue, max(od) max_days
      FROM o2 JOIN vendors v ON v.id=o2.vendor_id GROUP BY v.name,v.code ORDER BY 3 DESC LIMIT 10)
  SELECT jsonb_build_object('summary','payables','currency','NGN',
    'total_owed',(SELECT coalesce(sum(bal),0) FROM o2),'open_invoices',(SELECT count(*) FROM o2),
    'current',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od=0),
    'd1_30',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 1 AND 30),
    'd31_60',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 31 AND 60),
    'd61_90',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od BETWEEN 61 AND 90),
    'd90_plus',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od>90),
    'overdue_total',(SELECT coalesce(sum(bal),0) FROM o2 WHERE od>0),
    'top_suppliers',(SELECT coalesce(jsonb_agg(to_jsonb(top)),'[]') FROM top),
    'as_of',now(),'source_last_changed_at',(SELECT max(coalesce(posted_at,created_at)) FROM ap_invoices WHERE organization_id=v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 6. SALES ============
CREATE OR REPLACE FUNCTION public.ai_sales_performance() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['sales_reports','sales_dashboard','sales_orders']); r jsonb; d date := (date_trunc('month',current_date) - interval '11 months')::date;
BEGIN
  WITH mons AS (SELECT generate_series(d, date_trunc('month',current_date)::date, interval '1 month')::date mon),
  q AS (SELECT date_trunc('month',quotation_date)::date mon, count(*) n, sum(total_amount) v, count(*) FILTER (WHERE status='accepted') won FROM sales_quotations WHERE organization_id=v_org AND quotation_date>=d GROUP BY 1),
  so AS (SELECT date_trunc('month',order_date)::date mon, count(*) n, sum(total_amount) v FROM sales_orders WHERE organization_id=v_org AND status<>'cancelled' AND status<>'draft' AND order_date>=d GROUP BY 1),
  inv AS (SELECT date_trunc('month',invoice_date)::date mon, count(*) n, sum(total_amount) v FROM ar_invoices WHERE organization_id=v_org AND status='posted' AND NOT coalesce(is_opening_balance,false) AND invoice_date>=d GROUP BY 1)
  SELECT jsonb_build_object('summary','sales_performance','currency','NGN',
    'months',jsonb_agg(jsonb_build_object('month',to_char(mons.mon,'YYYY-MM'),
      'quotes',coalesce(q.n,0),'quote_value',coalesce(q.v,0),'quotes_accepted',coalesce(q.won,0),
      'orders',coalesce(so.n,0),'order_value',coalesce(so.v,0),'invoices',coalesce(inv.n,0),'invoiced_value',coalesce(inv.v,0),
      'avg_order',CASE WHEN coalesce(so.n,0)>0 THEN round(so.v/so.n,2) END) ORDER BY mons.mon),
    'quote_conversion_pct_12m',(SELECT CASE WHEN sum(n)>0 THEN round(sum(won)::numeric/sum(n)*100,1) END FROM q),
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM sales_orders WHERE organization_id=v_org)) INTO r
  FROM mons LEFT JOIN q USING(mon) LEFT JOIN so USING(mon) LEFT JOIN inv USING(mon);
  RETURN r;
END $$;

-- ============ 7. INVENTORY ============
CREATE OR REPLACE FUNCTION public.ai_inventory_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['inventory_valuation','inventory','warehouse_dashboard','warehouse_reports']); r jsonb;
BEGIN
  WITH bal AS (SELECT b.item_id, b.location_id, b.quantity, b.last_updated,
      coalesce((SELECT sum(remaining_qty*unit_cost)/nullif(sum(remaining_qty),0) FROM inventory_costing_layers cl WHERE cl.item_id=b.item_id AND cl.location_id=b.location_id AND cl.remaining_qty>0), i.unit_cost,0) uc
    FROM inventory_balances b JOIN items i ON i.id=b.item_id WHERE b.organization_id=v_org),
  byloc AS (SELECT l.name location, sum(quantity*uc) value, count(*) FILTER (WHERE quantity>0) items FROM bal JOIN locations l ON l.id=bal.location_id GROUP BY l.name ORDER BY 2 DESC),
  itq AS (SELECT item_id, sum(quantity) q, max(last_updated) lu, sum(quantity*uc) v FROM bal GROUP BY item_id),
  low AS (SELECT i.code, i.name, itq.q qty, i.reorder_level FROM itq JOIN items i ON i.id=itq.item_id WHERE coalesce(i.reorder_level,0)>0 AND itq.q<i.reorder_level ORDER BY (itq.q/i.reorder_level) LIMIT 10),
  slow AS (SELECT i.code, i.name, itq.q qty, itq.v value, (current_date-itq.lu::date) days_idle FROM itq JOIN items i ON i.id=itq.item_id WHERE itq.q>0 AND itq.lu < now()-interval '90 days' ORDER BY itq.v DESC LIMIT 10),
  exp AS (SELECT i.code, i.name, i.expiry_date, itq.q qty FROM itq JOIN items i ON i.id=itq.item_id WHERE itq.q>0 AND i.expiry_date IS NOT NULL AND i.expiry_date<=current_date+30 ORDER BY i.expiry_date LIMIT 10)
  SELECT jsonb_build_object('summary','inventory_position','currency','NGN',
    'total_stock_value',(SELECT coalesce(sum(quantity*uc),0) FROM bal),
    'value_by_warehouse',(SELECT coalesce(jsonb_agg(to_jsonb(byloc)),'[]') FROM byloc),
    'items_below_reorder_count',(SELECT count(*) FROM itq JOIN items i ON i.id=itq.item_id WHERE coalesce(i.reorder_level,0)>0 AND itq.q<i.reorder_level),
    'below_reorder',(SELECT coalesce(jsonb_agg(to_jsonb(low)),'[]') FROM low),
    'slow_moving_90d_count',(SELECT count(*) FROM itq WHERE q>0 AND lu<now()-interval '90 days'),
    'slow_moving_90d',(SELECT coalesce(jsonb_agg(to_jsonb(slow)),'[]') FROM slow),
    'expiring_30d',(SELECT coalesce(jsonb_agg(to_jsonb(exp)),'[]') FROM exp),
    'as_of',now(),'source_last_changed_at',(SELECT max(last_updated) FROM inventory_balances WHERE organization_id=v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 8. PROCUREMENT ============
CREATE OR REPLACE FUNCTION public.ai_procurement_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['procurement_dashboard','procurement_reports','purchase_orders']); r jsonb;
BEGIN
  SELECT jsonb_build_object('summary','procurement_position','currency','NGN',
    'pos_by_status',(SELECT coalesce(jsonb_object_agg(status, jsonb_build_object('count',n,'value',v)),'{}') FROM (SELECT status::text, count(*) n, coalesce(sum(total_amount),0) v FROM purchase_orders WHERE organization_id=v_org GROUP BY 1) s),
    'overdue_deliveries',(SELECT jsonb_build_object('count',count(*),'value',coalesce(sum(total_amount),0)) FROM purchase_orders WHERE organization_id=v_org AND status IN ('sent','partially_received','approved') AND expected_date<current_date),
    'po_approvals_older_7d',(SELECT count(*) FROM purchase_orders WHERE organization_id=v_org AND status='pending_approval' AND updated_at<now()-interval '7 days'),
    'requisitions_pending_approval',(SELECT count(*) FROM requisitions WHERE organization_id=v_org AND status='pending_approval'),
    'requisition_approvals_older_7d',(SELECT count(*) FROM requisitions WHERE organization_id=v_org AND status='pending_approval' AND coalesce(submitted_at,created_at)<now()-interval '7 days'),
    'requisitions_approved_not_ordered',(SELECT count(*) FROM requisitions WHERE organization_id=v_org AND status='approved'),
    'open_rfqs',(SELECT count(*) FROM rfps WHERE organization_id=v_org AND status IN ('published','evaluating')),
    'committed_open_po_value',(SELECT coalesce(sum(total_amount),0) FROM purchase_orders WHERE organization_id=v_org AND status IN ('approved','sent','partially_received')),
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM purchase_orders WHERE organization_id=v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 9. SUPPLIERS ============
CREATE OR REPLACE FUNCTION public.ai_supplier_performance() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['vendor_performance','vendors','procurement_reports']); r jsonb; y date := date_trunc('year',current_date)::date;
BEGIN
  WITH spend AS (SELECT vendor_id, sum(total_amount) spend, count(*) pos FROM purchase_orders WHERE organization_id=v_org AND status NOT IN ('draft','pending_approval','rejected','cancelled') AND order_date>=y GROUP BY 1),
  otd AS (SELECT p.vendor_id, count(*) FILTER (WHERE g.first_rcv<=p.expected_date) ontime, count(*) measured
    FROM purchase_orders p JOIN (SELECT po_id, min(receipt_date) first_rcv FROM goods_receipts WHERE organization_id=v_org GROUP BY 1) g ON g.po_id=p.id
    WHERE p.organization_id=v_org AND p.expected_date IS NOT NULL GROUP BY 1),
  owed AS (SELECT vendor_id, sum(total_amount - coalesce((SELECT sum(allocated_amount) FROM ap_payment_allocations a WHERE a.invoice_id=i.id),0)) o FROM ap_invoices i WHERE organization_id=v_org AND status='posted' AND coalesce(payment_status,'unpaid')<>'paid' GROUP BY 1),
  x AS (SELECT v.name, v.code, v.status::text status, v.blacklist_status, coalesce(s.spend,0) spend_ytd, coalesce(s.pos,0) pos_ytd,
      CASE WHEN otd.measured>0 THEN round(otd.ontime::numeric/otd.measured*100,1) END on_time_pct,
      coalesce(otd.measured,0) deliveries_measured, coalesce(owed.o,0) outstanding
    FROM vendors v LEFT JOIN spend s ON s.vendor_id=v.id LEFT JOIN otd ON otd.vendor_id=v.id LEFT JOIN owed ON owed.vendor_id=v.id
    WHERE v.organization_id=v_org AND (s.spend IS NOT NULL OR owed.o IS NOT NULL) ORDER BY spend_ytd DESC LIMIT 10)
  SELECT jsonb_build_object('summary','supplier_performance','currency','NGN',
    'active_suppliers',(SELECT count(*) FROM vendors WHERE organization_id=v_org AND status='active'),
    'blacklisted_suppliers',(SELECT count(*) FROM vendors WHERE organization_id=v_org AND status='blacklisted'),
    'top_suppliers',coalesce(jsonb_agg(to_jsonb(x)),'[]'),
    'note','on_time_pct is null ("not measured") when POs have no expected date',
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM purchase_orders WHERE organization_id=v_org)) INTO r FROM x;
  RETURN r;
END $$;

-- ============ 10. PAYROLL (totals only) ============
CREATE OR REPLACE FUNCTION public.ai_payroll_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['payroll_runs','hr_dashboard']); r jsonb;
BEGIN
  WITH runs AS (SELECT pr.period_year, pr.period_month, pr.status, pr.total_gross, pr.total_deductions, pr.total_net,
      (SELECT count(*) FROM payroll_lines pl WHERE pl.payroll_run_id=pr.id) headcount,
      (SELECT coalesce(sum(tax_amount),0) FROM payroll_lines pl WHERE pl.payroll_run_id=pr.id) paye,
      (SELECT coalesce(sum(coalesce(pension_employee,0)+coalesce(pension_employer,0)),0) FROM payroll_lines pl WHERE pl.payroll_run_id=pr.id) pension
    FROM payroll_runs pr WHERE pr.organization_id=v_org ORDER BY period_year DESC, period_month DESC LIMIT 12)
  SELECT jsonb_build_object('summary','payroll_position','currency','NGN',
    'active_employees',(SELECT count(*) FROM employees WHERE organization_id=v_org AND status='active'),
    'pending_leave_requests',(SELECT count(*) FROM leave_requests WHERE organization_id=v_org AND status='pending'),
    'runs',coalesce(jsonb_agg(jsonb_build_object('period',period_year||'-'||lpad(period_month::text,2,'0'),'status',status,
      'headcount',headcount,'gross',total_gross,'deductions',total_deductions,'net',total_net,'paye_tax',paye,'pension',pension)),'[]'),
    'note','Totals only. Individual salaries are never included.',
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM payroll_runs WHERE organization_id=v_org)) INTO r FROM runs;
  RETURN r;
END $$;

-- ============ 11. PROJECTS ============
CREATE OR REPLACE FUNCTION public.ai_project_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['project_profitability','projects','project_reports']); r jsonb;
BEGIN
  WITH p AS (SELECT project_code code, project_name name, status::text status, coalesce(budgeted_amount,0) budget,
      coalesce(total_costs,0) actual_cost, coalesce(total_revenue,0) revenue,
      CASE WHEN coalesce(total_revenue,0)<>0 THEN round((total_revenue-coalesce(total_costs,0))/total_revenue*100,1) END margin_pct,
      (coalesce(budgeted_amount,0)>0 AND coalesce(total_costs,0)>budgeted_amount) over_budget
    FROM projects WHERE organization_id=v_org AND status::text IN ('planning','active','on_hold')
    ORDER BY actual_cost DESC LIMIT 20)
  SELECT jsonb_build_object('summary','project_position','currency','NGN',
    'open_projects',(SELECT count(*) FROM projects WHERE organization_id=v_org AND status::text IN ('planning','active','on_hold')),
    'over_budget_count',(SELECT count(*) FROM p WHERE over_budget),
    'projects',coalesce(jsonb_agg(to_jsonb(p)),'[]'),
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM projects WHERE organization_id=v_org)) INTO r FROM p;
  RETURN r;
END $$;

-- ============ 13. CUSTOMERS ============
CREATE OR REPLACE FUNCTION public.ai_customer_intelligence() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['customers','sales_reports','ar_reports']); r jsonb;
BEGIN
  WITH inv AS (SELECT customer_id, invoice_date, total_amount, id, due_date FROM ar_invoices WHERE organization_id=v_org AND status='posted' AND NOT coalesce(is_opening_balance,false)),
  per AS (SELECT c.id, c.name, c.code,
      coalesce((SELECT sum(total_amount) FROM inv WHERE customer_id=c.id AND invoice_date>=date_trunc('year',current_date)),0) sales_ytd,
      coalesce((SELECT sum(total_amount) FROM inv WHERE customer_id=c.id AND invoice_date>=current_date-90),0) last_3m,
      coalesce((SELECT sum(total_amount) FROM inv WHERE customer_id=c.id AND invoice_date<current_date-90 AND invoice_date>=current_date-180),0) prior_3m,
      coalesce((SELECT sum(i.total_amount - coalesce((SELECT sum(allocated_amount) FROM ar_receipt_allocations a WHERE a.invoice_id=i.id),0)) FROM ar_invoices i WHERE i.customer_id=c.id AND i.status='posted' AND i.payment_status<>'paid'),0) balance,
      coalesce((SELECT sum(i.total_amount - coalesce((SELECT sum(allocated_amount) FROM ar_receipt_allocations a WHERE a.invoice_id=i.id),0)) FROM ar_invoices i WHERE i.customer_id=c.id AND i.status='posted' AND i.payment_status<>'paid' AND i.due_date<current_date),0) overdue
    FROM customers c WHERE c.organization_id=v_org),
  t AS (SELECT name, code, sales_ytd, last_3m, prior_3m, balance, overdue,
      CASE WHEN prior_3m=0 AND last_3m>0 THEN 'new_or_rising' WHEN prior_3m>0 AND last_3m>=prior_3m*1.1 THEN 'rising' WHEN prior_3m>0 AND last_3m<=prior_3m*0.9 THEN 'declining' ELSE 'steady' END trend FROM per)
  SELECT jsonb_build_object('summary','customer_intelligence','currency','NGN',
    'total_customers',(SELECT count(*) FROM customers WHERE organization_id=v_org),
    'active_flag_customers',(SELECT count(*) FROM customers WHERE organization_id=v_org AND is_active),
    'buying_last_90d',(SELECT count(DISTINCT customer_id) FROM inv WHERE invoice_date>=current_date-90),
    'new_this_month',(SELECT count(*) FROM customers WHERE organization_id=v_org AND created_at>=date_trunc('month',now())),
    'inactive_no_purchase_180d',(SELECT count(*) FROM customers c WHERE organization_id=v_org AND NOT EXISTS (SELECT 1 FROM inv WHERE customer_id=c.id AND invoice_date>=current_date-180)),
    'top_customers',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM t ORDER BY sales_ytd DESC LIMIT 10) x),
    'rising',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'last_3m',last_3m,'prior_3m',prior_3m)),'[]') FROM (SELECT * FROM t WHERE trend IN ('rising','new_or_rising') ORDER BY last_3m-prior_3m DESC LIMIT 5) x),
    'declining',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'last_3m',last_3m,'prior_3m',prior_3m)),'[]') FROM (SELECT * FROM t WHERE trend='declining' ORDER BY last_3m-prior_3m LIMIT 5) x),
    'customer_profitability','unavailable: cost of sales is not recorded per customer (only via projects)',
    'as_of',now(),'source_last_changed_at',(SELECT max(updated_at) FROM ar_invoices WHERE organization_id=v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 14. EXPENSES ============
CREATE OR REPLACE FUNCTION public.ai_expense_analysis() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['financial_reports','finance_dashboard','budget_reports']); r jsonb;
  m0 date := date_trunc('month',current_date)::date;
BEGIN
  WITH l AS (SELECT a.id, a.account_code code, a.account_name name, date_trunc('month',e.entry_date)::date mon, sum(l.debit-l.credit) amt
      FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id JOIN gl_accounts a ON a.id=l.account_id
      WHERE e.organization_id=v_org AND e.status='posted' AND a.account_type::text='expense' AND e.entry_date>=(m0-interval '5 months')
      GROUP BY 1,2,3,4),
  monthly AS (SELECT to_char(mon,'YYYY-MM') AS month, sum(amt) AS total FROM l GROUP BY mon ORDER BY mon),
  cat AS (SELECT code, name,
      coalesce(sum(amt) FILTER (WHERE mon=m0),0) this_month,
      coalesce(sum(amt) FILTER (WHERE mon=(m0-interval '1 month')::date),0) last_month,
      coalesce(sum(amt) FILTER (WHERE mon<m0 AND mon>=(m0-interval '3 months')::date),0)/3.0 avg_prev_3m,
      sum(amt) total_6m FROM l GROUP BY code,name),
  ytd AS (SELECT account_id, account_code, account_name, balance FROM public.ai_account_balances(v_org, date_trunc('year',current_date)::date, current_date) WHERE account_type='expense' AND balance<>0),
  bud AS (SELECT bl.account_id, sum(coalesce(bl.budgeted_amount,bl.annual_amount,0)) budget FROM budget_lines bl JOIN budgets b ON b.id=bl.budget_id
      WHERE b.organization_id=v_org AND b.fiscal_year=extract(year FROM current_date) AND b.status::text IN ('active','approved') AND bl.account_id IS NOT NULL GROUP BY 1)
  SELECT jsonb_build_object('summary','expense_analysis','currency','NGN',
    'total_expenses_ytd',(SELECT coalesce(sum(balance),0) FROM ytd),
    'monthly_totals',(SELECT coalesce(jsonb_agg(to_jsonb(monthly)),'[]') FROM monthly),
    'largest_categories_ytd',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',account_code,'name',account_name,'ytd',balance,'budget_full_year',bud.budget,
        'budget_used_pct',CASE WHEN bud.budget>0 THEN round(balance/bud.budget*100,1) END)),'[]') FROM (SELECT * FROM ytd ORDER BY balance DESC LIMIT 10) y LEFT JOIN bud ON bud.account_id=y.account_id),
    'unusual_movements',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'this_month',this_month,'avg_prev_3m',round(avg_prev_3m,2),
        'change_pct',CASE WHEN avg_prev_3m>0 THEN round((this_month-avg_prev_3m)/avg_prev_3m*100,1) END)),'[]')
        FROM cat WHERE avg_prev_3m>0 AND this_month>avg_prev_3m*1.5),
    'as_of',now(),'source_last_changed_at',public.ai_journal_last_change(v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 15. TAX ============
CREATE OR REPLACE FUNCTION public.ai_tax_position() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['tax_configuration','financial_reports','compliance_reports']); r jsonb; y date := date_trunc('year',current_date)::date;
BEGIN
  WITH tax_acc AS (SELECT DISTINCT gl_account_id id FROM tax_rates WHERE organization_id=v_org AND gl_account_id IS NOT NULL
      UNION SELECT id FROM gl_accounts WHERE organization_id=v_org AND account_type::text='liability' AND (account_name ILIKE '%tax%' OR account_name ILIKE '%vat%' OR account_name ILIKE '%wht%' OR account_name ILIKE '%paye%')),
  bal AS (SELECT b.* FROM public.ai_account_balances(v_org,NULL,NULL) b JOIN tax_acc t ON t.id=b.account_id)
  SELECT jsonb_build_object('summary','tax_position','currency','NGN',
    'tax_liability_accounts',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',account_code,'name',account_name,'balance_owed',balance)),'[]') FROM bal),
    'net_tax_liability_ledger',(SELECT coalesce(sum(balance),0) FROM bal),
    'output_tax_collected_ytd',(SELECT coalesce(sum(tax_amount),0) FROM ar_invoices WHERE organization_id=v_org AND status='posted' AND invoice_date>=y),
    'input_tax_on_purchases_ytd',(SELECT coalesce(sum(tax_amount),0) FROM ap_invoices WHERE organization_id=v_org AND status='posted' AND invoice_date>=y),
    'by_month',(SELECT coalesce(jsonb_agg(jsonb_build_object('month',m,'output_tax',o) ORDER BY m),'[]') FROM (SELECT to_char(invoice_date,'YYYY-MM') m, sum(tax_amount) o FROM ar_invoices WHERE organization_id=v_org AND status='posted' AND invoice_date>=y GROUP BY 1) s),
    'rates_in_use',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',tr.name,'rate_pct',tr.rate_pct,'group',tg.name)),'[]') FROM tax_rates tr LEFT JOIN tax_groups tg ON tg.id=tr.tax_group_id WHERE tr.organization_id=v_org AND tr.is_active),
    'filing_status','unavailable: the ERP does not store tax returns or filing periods',
    'as_of',now(),'source_last_changed_at',public.ai_journal_last_change(v_org)) INTO r;
  RETURN r;
END $$;

-- ============ 12. ALERTS (only areas the user can see) ============
CREATE OR REPLACE FUNCTION public.ai_business_alerts() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['dashboard','financial_reports','procurement_dashboard','inventory','ar_aging','ap_aging','projects','sales_reports','payroll_runs']);
  a jsonb := '[]'; j jsonb; al boolean;
BEGIN
  SELECT alerts_enabled INTO al FROM ai_settings WHERE organization_id=v_org;
  IF NOT coalesce(al,true) THEN RETURN jsonb_build_object('summary','business_alerts','alerts','[]','note','Alerts are switched off for this company','as_of',now()); END IF;
  IF public.ai_can('bank_accounts') OR public.ai_can('cash_dashboard') OR public.ai_can('financial_reports') THEN
    j := public.ai_cash_position();
    IF (j->>'total_cash_ledger')::numeric < 0 THEN a := a || jsonb_build_object('type','negative_cash','severity','high','message','Cash in the ledger is negative','amount',j->'total_cash_ledger','link','/bank-accounts'); END IF;
  END IF;
  IF public.ai_can('ar_aging') OR public.ai_can('ar_reports') OR public.ai_can('ar_invoices') THEN
    j := public.ai_receivables();
    IF (j->>'d90_plus')::numeric > 0 THEN a := a || jsonb_build_object('type','receivables_90_plus','severity','high','message','Customer invoices overdue by more than 90 days','amount',j->'d90_plus','link','/ar-aging');
    ELSIF (j->>'overdue_total')::numeric > 0 THEN a := a || jsonb_build_object('type','overdue_receivables','severity','medium','message','Customers have overdue invoices','amount',j->'overdue_total','link','/ar-aging'); END IF;
  END IF;
  IF public.ai_can('ap_aging') OR public.ai_can('ap_reports') OR public.ai_can('invoices') THEN
    j := public.ai_payables();
    IF (j->>'overdue_total')::numeric > 0 THEN a := a || jsonb_build_object('type','overdue_payables','severity','medium','message','Supplier invoices are past due','amount',j->'overdue_total','link','/ap-aging'); END IF;
  END IF;
  IF public.ai_can('inventory_valuation') OR public.ai_can('inventory') OR public.ai_can('warehouse_dashboard') THEN
    j := public.ai_inventory_position();
    IF (j->>'items_below_reorder_count')::int > 0 THEN a := a || jsonb_build_object('type','low_stock','severity','medium','message',(j->>'items_below_reorder_count')||' items are below reorder level','link','/inventory'); END IF;
    IF jsonb_array_length(j->'expiring_30d') > 0 THEN a := a || jsonb_build_object('type','expiring_stock','severity','medium','message',jsonb_array_length(j->'expiring_30d')||' items expire within 30 days','link','/inventory-reports'); END IF;
  END IF;
  IF public.ai_can('procurement_dashboard') OR public.ai_can('purchase_orders') OR public.ai_can('procurement_reports') THEN
    j := public.ai_procurement_position();
    IF (j->>'po_approvals_older_7d')::int + (j->>'requisition_approvals_older_7d')::int > 0 THEN a := a || jsonb_build_object('type','stuck_approvals','severity','medium','message',((j->>'po_approvals_older_7d')::int + (j->>'requisition_approvals_older_7d')::int)||' approvals waiting more than 7 days','link','/purchase-orders'); END IF;
    IF (j->'overdue_deliveries'->>'count')::int > 0 THEN a := a || jsonb_build_object('type','late_deliveries','severity','medium','message',(j->'overdue_deliveries'->>'count')||' purchase orders are past their expected delivery date','amount',j->'overdue_deliveries'->'value','link','/goods-delivered'); END IF;
  END IF;
  IF public.ai_can('project_profitability') OR public.ai_can('projects') OR public.ai_can('project_reports') THEN
    j := public.ai_project_position();
    IF (j->>'over_budget_count')::int > 0 THEN a := a || jsonb_build_object('type','projects_over_budget','severity','high','message',(j->>'over_budget_count')||' projects have spent more than budget','link','/projects'); END IF;
  END IF;
  RETURN jsonb_build_object('summary','business_alerts','alert_count',jsonb_array_length(a),'alerts',a,'as_of',now());
END $$;

-- ============ 1. BUSINESS HEALTH (primary context) ============
CREATE OR REPLACE FUNCTION public.ai_business_health() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['dashboard','financial_reports','procurement_dashboard','inventory','ar_aging','ap_aging','sales_reports','hr_dashboard','projects']);
  res jsonb := jsonb_build_object('summary','business_health','currency','NGN','as_of',now()); restricted text[] := '{}'; j jsonb; y int := extract(year FROM current_date)::int; cur jsonb; prev jsonb;
BEGIN
  res := res || jsonb_build_object('company',(SELECT name FROM organizations WHERE id=v_org),
    'current_period',(SELECT period_name FROM gl_fiscal_periods WHERE organization_id=v_org AND current_date BETWEEN start_date AND end_date LIMIT 1));
  IF public.ai_can('financial_reports') OR public.ai_can('finance_dashboard') THEN
    cur := public.ai_pl_totals(v_org, make_date(y,1,1), current_date);
    prev := public.ai_pl_totals(v_org, make_date(y-1,1,1), (current_date - interval '1 year')::date);
    res := res || jsonb_build_object('profit_loss_ytd',cur,'profit_loss_last_year_same_period',prev,
      'profit_vs_last_year_pct',CASE WHEN (prev->>'net_profit')::numeric<>0 THEN round(((cur->>'net_profit')::numeric-(prev->>'net_profit')::numeric)/abs((prev->>'net_profit')::numeric)*100,1) END);
  ELSE restricted := restricted || 'profit_loss'; END IF;
  IF public.ai_can('bank_accounts') OR public.ai_can('cash_dashboard') OR public.ai_can('financial_reports') THEN
    j := public.ai_cash_position(); res := res || jsonb_build_object('cash',j->'total_cash_ledger');
  ELSE restricted := restricted || 'cash'; END IF;
  IF public.ai_can('ar_aging') OR public.ai_can('ar_reports') OR public.ai_can('ar_invoices') THEN
    j := public.ai_receivables(); res := res || jsonb_build_object('receivables',j->'total_owed','overdue_receivables',j->'overdue_total');
  ELSE restricted := restricted || 'receivables'; END IF;
  IF public.ai_can('ap_aging') OR public.ai_can('ap_reports') OR public.ai_can('invoices') THEN
    j := public.ai_payables(); res := res || jsonb_build_object('payables',j->'total_owed','overdue_payables',j->'overdue_total');
  ELSE restricted := restricted || 'payables'; END IF;
  IF public.ai_can('inventory_valuation') OR public.ai_can('inventory') OR public.ai_can('warehouse_dashboard') THEN
    j := public.ai_inventory_position(); res := res || jsonb_build_object('stock_value',j->'total_stock_value','items_below_reorder',j->'items_below_reorder_count');
  ELSE restricted := restricted || 'inventory'; END IF;
  IF public.ai_can('procurement_dashboard') OR public.ai_can('purchase_orders') OR public.ai_can('procurement_reports') THEN
    j := public.ai_procurement_position();
    res := res || jsonb_build_object('pending_po_approvals',coalesce((j->'pos_by_status'->'pending_approval'->>'count')::int,0),
      'pending_requisition_approvals',j->'requisitions_pending_approval','committed_open_po_value',j->'committed_open_po_value');
  ELSE restricted := restricted || 'procurement'; END IF;
  j := public.ai_business_alerts();
  res := res || jsonb_build_object('alert_count',j->'alert_count','top_alerts',
    (SELECT coalesce(jsonb_agg(e),'[]') FROM (SELECT e FROM jsonb_array_elements(j->'alerts') e ORDER BY (e->>'severity')='high' DESC LIMIT 3) s));
  RETURN res || jsonb_build_object('restricted_areas',to_jsonb(restricted),'source_last_changed_at',public.ai_journal_last_change(v_org));
END $$;

-- ============ PERMISSIONS: signed-in users only ============
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ai_business_health()','ai_profit_loss_monthly()','ai_cash_position()','ai_receivables()','ai_payables()','ai_sales_performance()',
    'ai_inventory_position()','ai_procurement_position()','ai_supplier_performance()','ai_payroll_position()','ai_project_position()','ai_business_alerts()',
    'ai_customer_intelligence()','ai_expense_analysis()','ai_tax_position()','ai_can(text)','ai_guard(text[])',
    'ai_account_balances(uuid,date,date)','ai_pl_totals(uuid,date,date)','ai_journal_last_change(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['ai_business_health()','ai_profit_loss_monthly()','ai_cash_position()','ai_receivables()','ai_payables()','ai_sales_performance()',
    'ai_inventory_position()','ai_procurement_position()','ai_supplier_performance()','ai_payroll_position()','ai_project_position()','ai_business_alerts()',
    'ai_customer_intelligence()','ai_expense_analysis()','ai_tax_position()'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- internal helpers take an org id: never callable by users directly
  REVOKE ALL ON FUNCTION public.ai_account_balances(uuid,date,date) FROM authenticated;
  REVOKE ALL ON FUNCTION public.ai_pl_totals(uuid,date,date) FROM authenticated;
  REVOKE ALL ON FUNCTION public.ai_journal_last_change(uuid) FROM authenticated;
END $$;

-- ============ SPEED ============
CREATE INDEX IF NOT EXISTS idx_gl_je_org_status_date ON public.gl_journal_entries(organization_id, status, entry_date);
CREATE INDEX IF NOT EXISTS idx_gl_jl_entry ON public.gl_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_gl_jl_account ON public.gl_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_ar_inv_org_pay_due ON public.ar_invoices(organization_id, payment_status, due_date);
CREATE INDEX IF NOT EXISTS idx_ap_inv_org_pay_due ON public.ap_invoices(organization_id, payment_status, due_date);
CREATE INDEX IF NOT EXISTS idx_ar_alloc_inv ON public.ar_receipt_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ap_alloc_inv ON public.ap_payment_allocations(invoice_id);

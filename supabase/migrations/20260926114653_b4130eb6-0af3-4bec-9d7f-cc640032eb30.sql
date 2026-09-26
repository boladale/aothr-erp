
CREATE OR REPLACE FUNCTION public.ai_revenue_breakdown() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['sales_reports','customers','financial_reports','ar_invoices']);
  ty date := date_trunc('year',current_date)::date; ly date := (date_trunc('year',current_date) - interval '1 year')::date;
  lyt date := (current_date - interval '1 year')::date; r jsonb;
BEGIN
  WITH inv AS (SELECT i.* FROM ar_invoices i WHERE i.organization_id=v_org AND i.status='posted' AND coalesce(i.is_opening_balance,false)=false),
  cust AS (SELECT c.name, c.code,
      coalesce(sum(i.subtotal) FILTER (WHERE i.invoice_date>=ty),0) ytd,
      coalesce(sum(i.subtotal) FILTER (WHERE i.invoice_date BETWEEN ly AND lyt),0) ly_same_period,
      coalesce(sum(i.subtotal) FILTER (WHERE i.invoice_date>=ly AND i.invoice_date<ty),0) ly_full_year,
      max(i.invoice_date) last_invoice_date, current_date-max(i.invoice_date) days_since_last_invoice
    FROM customers c LEFT JOIN inv i ON i.customer_id=c.id WHERE c.organization_id=v_org GROUP BY c.name,c.code),
  tot AS (SELECT sum(ytd) t FROM cust),
  prod AS (SELECT coalesce(it.name, l.description,'Other') product,
      coalesce(sum(l.line_total) FILTER (WHERE i.invoice_date>=ty),0) ytd,
      coalesce(sum(l.line_total) FILTER (WHERE i.invoice_date BETWEEN ly AND lyt),0) ly_same_period
    FROM inv i JOIN ar_invoice_lines l ON l.invoice_id=i.id LEFT JOIN items it ON it.id=l.item_id
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20),
  mon AS (SELECT to_char(invoice_date,'YYYY-MM') AS month, sum(subtotal) AS sales FROM inv WHERE invoice_date>=ly GROUP BY 1 ORDER BY 1)
  SELECT jsonb_build_object('summary','revenue_breakdown','currency','NGN','note','Sales excluding VAT from posted customer invoices; ly_same_period = 1 Jan to same date last year.',
    'total_ytd',(SELECT t FROM tot),
    'total_ly_same_period',(SELECT sum(ly_same_period) FROM cust),
    'customers',(SELECT coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('share_of_ytd_pct', CASE WHEN (SELECT t FROM tot)>0 THEN round(x.ytd*100/(SELECT t FROM tot),1) END,
         'change_vs_ly', x.ytd - x.ly_same_period) ORDER BY x.ytd DESC),'[]') FROM cust x),
    'top1_share_pct',(SELECT CASE WHEN t>0 THEN round((SELECT max(ytd) FROM cust)*100/t,1) END FROM tot),
    'top3_share_pct',(SELECT CASE WHEN t>0 THEN round((SELECT sum(ytd) FROM (SELECT ytd FROM cust ORDER BY ytd DESC LIMIT 3) z)*100/t,1) END FROM tot),
    'products_services',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]') FROM prod p),
    'sales_by_month',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM mon m),
    'as_of',now()) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ai_cost_breakdown() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['financial_reports','expense_analysis','finance_dashboard']);
  ty date := date_trunc('year',current_date)::date; ly date := (date_trunc('year',current_date) - interval '1 year')::date;
  lyt date := (current_date - interval '1 year')::date; r jsonb;
BEGIN
  WITH ln AS (SELECT a.account_code, a.account_name, e.entry_date, (l.debit-l.credit) amt
      FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id JOIN gl_accounts a ON a.id=l.account_id
      WHERE e.organization_id=v_org AND e.status='posted' AND a.account_type='expense' AND e.entry_date>=ly
        AND coalesce(e.source_module,'') NOT IN ('year_end_close','period_close')),
  acc AS (SELECT account_code code, account_name name,
      coalesce(sum(amt) FILTER (WHERE entry_date>=ty),0) ytd,
      coalesce(sum(amt) FILTER (WHERE entry_date BETWEEN ly AND lyt),0) ly_same_period,
      coalesce(sum(amt) FILTER (WHERE entry_date>=date_trunc('month',current_date)),0) this_month,
      coalesce(sum(amt) FILTER (WHERE entry_date>=date_trunc('month',current_date)-interval '1 month' AND entry_date<date_trunc('month',current_date)),0) last_month
    FROM ln GROUP BY 1,2),
  mon AS (SELECT to_char(entry_date,'YYYY-MM') AS month, account_name, sum(amt) AS amount FROM ln GROUP BY 1,2),
  mt AS (SELECT to_char(entry_date,'YYYY-MM') AS month, sum(amt) AS total FROM ln GROUP BY 1 ORDER BY 1)
  SELECT jsonb_build_object('summary','cost_breakdown','currency','NGN','note','Posted expense accounts (cost of sales codes 5xxx included). ly_same_period = same dates last year.',
    'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('change_vs_ly',a.ytd-a.ly_same_period,
        'change_pct',CASE WHEN a.ly_same_period<>0 THEN round((a.ytd-a.ly_same_period)*100/abs(a.ly_same_period),1) END) ORDER BY a.ytd DESC),'[]') FROM acc a),
    'biggest_increases',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'increase',ytd-ly_same_period) ORDER BY ytd-ly_same_period DESC),'[]')
        FROM (SELECT * FROM acc WHERE ytd-ly_same_period>0 ORDER BY ytd-ly_same_period DESC LIMIT 5) z),
    'monthly_totals',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM mt m),
    'by_month_by_account',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY month),'[]') FROM mon m),
    'as_of',now()) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ai_cash_outlook() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['cash_reports','cash_dashboard','bank_accounts','financial_reports']); r jsonb;
BEGIN
  WITH ba AS (SELECT DISTINCT gl_account_id FROM bank_accounts WHERE organization_id=v_org AND gl_account_id IS NOT NULL),
  me AS (SELECT (date_trunc('month',current_date) - (g||' month')::interval + interval '1 month - 1 day')::date d FROM generate_series(0,6) g),
  bal AS (SELECT to_char(me.d,'YYYY-MM') AS month, least(me.d,current_date) AS as_at,
      (SELECT coalesce(sum(l.debit-l.credit),0) FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id
        WHERE e.organization_id=v_org AND e.status='posted' AND l.account_id IN (SELECT gl_account_id FROM ba) AND e.entry_date<=me.d) AS cash
      FROM me),
  ap AS (SELECT i.invoice_number, v.name supplier, i.due_date, i.total_amount - coalesce((SELECT sum(amount) FROM ap_payment_allocations a WHERE a.invoice_id=i.id),0) bal
      FROM ap_invoices i JOIN vendors v ON v.id=i.vendor_id WHERE i.organization_id=v_org AND i.status='posted' AND coalesce(i.payment_status,'')<>'paid'),
  ar AS (SELECT i.invoice_number, c.name customer, i.invoice_date, i.due_date, i.total_amount - coalesce((SELECT sum(allocated_amount) FROM ar_receipt_allocations a WHERE a.invoice_id=i.id),0) bal
      FROM ar_invoices i JOIN customers c ON c.id=i.customer_id WHERE i.organization_id=v_org AND i.status='posted' AND i.payment_status<>'paid')
  SELECT jsonb_build_object('summary','cash_outlook','currency','NGN',
    'cash_now_bank_accounts_page',(SELECT coalesce(sum(current_balance),0) FROM bank_accounts WHERE organization_id=v_org AND is_active),
    'cash_month_end_ledger',(SELECT jsonb_agg(to_jsonb(b) ORDER BY month) FROM bal b),
    'supplier_bills_overdue',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY due_date),'[]') FROM ap x WHERE bal>0.005 AND due_date<current_date),
    'supplier_bills_due_next_30d',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY due_date),'[]') FROM ap x WHERE bal>0.005 AND due_date BETWEEN current_date AND current_date+30),
    'customer_payments_expected_next_30d',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY due_date),'[]') FROM ar x WHERE bal>0.005 AND due_date BETWEEN current_date AND current_date+30),
    'oldest_unpaid_customer_invoices',(SELECT coalesce(jsonb_agg(to_jsonb(z)),'[]') FROM (SELECT *, current_date-due_date days_overdue FROM ar WHERE bal>0.005 ORDER BY due_date LIMIT 10) z),
    'as_of',now()) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ai_procurement_spend() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['procurement','purchase_orders','vendors','ap_reports','inventory']);
  ty date := date_trunc('year',current_date)::date; ly date := (date_trunc('year',current_date) - interval '1 year')::date;
  lyt date := (current_date - interval '1 year')::date; r jsonb;
BEGIN
  WITH po AS (SELECT * FROM purchase_orders WHERE organization_id=v_org AND status IN ('approved','sent','partially_received','fully_received','closed')),
  bills AS (SELECT * FROM ap_invoices WHERE organization_id=v_org AND status='posted' AND coalesce(is_opening_balance,false)=false),
  pay AS (SELECT v.name supplier, coalesce(sum(p.total_amount) FILTER (WHERE p.payment_date>=ty),0) paid_ytd,
      coalesce(sum(p.total_amount) FILTER (WHERE p.payment_date BETWEEN ly AND lyt),0) paid_ly_same_period
      FROM ap_payments p JOIN vendors v ON v.id=p.vendor_id WHERE p.organization_id=v_org AND p.status='posted' GROUP BY 1),
  del AS (SELECT v.name supplier, count(*) deliveries, count(*) FILTER (WHERE g.receipt_date>po.expected_date) late,
      round(avg(greatest(g.receipt_date-po.expected_date,0)),1) avg_days_late
      FROM goods_receipts g JOIN po ON po.id=g.po_id JOIN vendors v ON v.id=po.vendor_id
      WHERE g.status='posted' AND po.expected_date IS NOT NULL GROUP BY 1),
  stock AS (SELECT it.name AS item, it.code, sum(b.quantity) AS qty, sum(b.quantity*coalesce(it.unit_cost,0)) AS value
      FROM inventory_balances b JOIN items it ON it.id=b.item_id WHERE b.organization_id=v_org GROUP BY 1,2 HAVING sum(b.quantity)>0 ORDER BY 4 DESC LIMIT 15)
  SELECT jsonb_build_object('summary','procurement_spend','currency','NGN',
    'po_value_ordered_ytd',(SELECT coalesce(sum(total_amount),0) FROM po WHERE order_date>=ty),
    'po_value_ordered_ly_same_period',(SELECT coalesce(sum(total_amount),0) FROM po WHERE order_date BETWEEN ly AND lyt),
    'supplier_bills_ytd',(SELECT coalesce(sum(total_amount),0) FROM bills WHERE invoice_date>=ty),
    'supplier_bills_ly_same_period',(SELECT coalesce(sum(total_amount),0) FROM bills WHERE invoice_date BETWEEN ly AND lyt),
    'payments_by_supplier',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY paid_ytd DESC),'[]') FROM pay p),
    'delivery_record_by_supplier',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY late DESC),'[]') FROM del d),
    'stock_value_by_item',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM stock s),
    'as_of',now()) INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.ai_revenue_breakdown(), public.ai_cost_breakdown(), public.ai_cash_outlook(), public.ai_procurement_spend() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_revenue_breakdown(), public.ai_cost_breakdown(), public.ai_cash_outlook(), public.ai_procurement_spend() TO authenticated;

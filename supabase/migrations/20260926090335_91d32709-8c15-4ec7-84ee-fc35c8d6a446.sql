CREATE OR REPLACE FUNCTION public.ai_business_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    j := public.ai_cash_position(); res := res || jsonb_build_object('cash',j->'total_cash_book','cash_in_ledger',j->'total_cash_ledger',
      'cash_note',CASE WHEN (j->>'total_cash_book')::numeric<>(j->>'total_cash_ledger')::numeric THEN 'Bank balances on the Bank Accounts page differ from the posted accounting ledger: opening balances or bank transactions have not been posted as journals, or a bank account is not linked to a ledger account.' END);
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
END $function$;
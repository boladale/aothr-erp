CREATE OR REPLACE FUNCTION public.ai_customer_directory()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['customers','sales_reports','ar_reports']); r jsonb;
BEGIN
  SELECT jsonb_build_object('summary','customer_directory','as_of',now(),'customers',coalesce(jsonb_agg(jsonb_build_object(
    'name',name,'code',code,'phone',phone,'email',email,'address',address,'city',city,'country',country,
    'payment_terms_days',payment_terms,'credit_limit',credit_limit,'active',is_active) ORDER BY name),'[]'))
  INTO r FROM (SELECT * FROM customers WHERE organization_id=v_org ORDER BY name LIMIT 200) c;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ai_revenue_by_account()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.ai_guard(ARRAY['financial_reports','finance_dashboard']); r jsonb;
  y0 date := date_trunc('year',current_date)::date; p0 date := (date_trunc('year',current_date) - interval '1 year')::date;
  pe date := (current_date - interval '1 year')::date;
BEGIN
  WITH l AS (
    SELECT a.account_code, a.account_name, a.account_type::text t, e.entry_date d, (l.credit-l.debit) amt
    FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id JOIN gl_accounts a ON a.id=l.account_id
    WHERE e.organization_id=v_org AND e.status='posted' AND a.account_type::text IN ('revenue','income') AND e.entry_date>=p0),
  g AS (SELECT account_code, account_name,
      sum(amt) FILTER (WHERE d>=y0 AND d<=current_date) ytd,
      sum(amt) FILTER (WHERE d>=p0 AND d<=pe) last_ytd
    FROM l GROUP BY 1,2)
  SELECT jsonb_build_object('summary','revenue_by_income_account','as_of',now(),
    'period','This year to date vs same period last year','accounts',coalesce(jsonb_agg(jsonb_build_object(
      'account_code',account_code,'account_name',account_name,'ytd',coalesce(ytd,0),'last_year_same_period',coalesce(last_ytd,0))
      ORDER BY coalesce(ytd,0) DESC),'[]'))
  INTO r FROM g;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.ai_customer_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_revenue_by_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_customer_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_revenue_by_account() TO authenticated;
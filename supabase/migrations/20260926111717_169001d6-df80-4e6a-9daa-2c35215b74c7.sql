CREATE OR REPLACE FUNCTION public.ai_revenue_by_account()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := public.ai_guard(ARRAY['financial_reports','finance_dashboard']); r jsonb;
  y0 date := date_trunc('year',current_date)::date; p0 date := (date_trunc('year',current_date) - interval '1 year')::date;
  pe date := (current_date - interval '1 year')::date;
BEGIN
  WITH l AS (
    SELECT a.account_code, a.account_name, e.entry_date d, (l.credit-l.debit) amt
    FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id=l.journal_entry_id JOIN gl_accounts a ON a.id=l.account_id
    WHERE e.organization_id=v_org AND e.status='posted' AND a.account_type::text IN ('revenue','income') AND e.entry_date>=p0),
  g AS (SELECT account_code, account_name,
      sum(amt) FILTER (WHERE d>=y0 AND d<=current_date) ytd,
      sum(amt) FILTER (WHERE d>=p0 AND d<=pe) last_ytd
    FROM l GROUP BY 1,2),
  m AS (SELECT to_char(d,'YYYY-MM') mon, account_name, sum(amt) amt FROM l GROUP BY 1,2),
  mj AS (SELECT mon, jsonb_object_agg(account_name, amt) accts, sum(amt) total FROM m GROUP BY mon)
  SELECT jsonb_build_object('summary','revenue_by_income_account','as_of',now(),
    'period','This year to date vs same period last year, plus monthly breakdown per account',
    'accounts',(SELECT coalesce(jsonb_agg(jsonb_build_object('account_code',account_code,'account_name',account_name,
        'ytd',coalesce(ytd,0),'last_year_same_period',coalesce(last_ytd,0)) ORDER BY coalesce(ytd,0) DESC),'[]') FROM g),
    'by_month',(SELECT coalesce(jsonb_agg(jsonb_build_object('month',mon,'total',total,'by_account',accts) ORDER BY mon),'[]') FROM mj))
  INTO r;
  RETURN r;
END $function$;
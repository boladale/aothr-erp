CREATE OR REPLACE FUNCTION public.ai_cash_position()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.ai_guard(ARRAY['bank_accounts','cash_dashboard','cash_reports','financial_reports']);
  r jsonb;
BEGIN
  WITH lb AS (SELECT * FROM public.ai_account_balances(v_org,NULL,NULL)),
  banks AS (
    SELECT b.id, b.account_name, b.bank_name, b.account_type, b.currency,
      b.gl_account_id, b.current_balance book_balance
    FROM public.bank_accounts b
    WHERE b.organization_id=v_org AND b.is_active
  ),
  groups AS (
    SELECT b.gl_account_id, count(*) bank_account_count,
      jsonb_agg(b.account_name ORDER BY b.account_name) bank_accounts,
      sum(b.book_balance) book_balance,
      lb.account_code, lb.account_name ledger_account, lb.balance ledger_balance
    FROM banks b LEFT JOIN lb ON lb.account_id=b.gl_account_id
    WHERE b.gl_account_id IS NOT NULL
    GROUP BY b.gl_account_id, lb.account_code, lb.account_name, lb.balance
  )
  SELECT jsonb_build_object(
    'summary','cash_position','currency','NGN',
    'total_cash_ledger',(SELECT coalesce(sum(g.ledger_balance),0) FROM groups g),
    'total_cash_book',(SELECT coalesce(sum(b.book_balance),0) FROM banks b),
    'difference',(SELECT coalesce(sum(b.book_balance),0) FROM banks b)-(SELECT coalesce(sum(g.ledger_balance),0) FROM groups g),
    'accounts',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'account',b.account_name,'bank',b.bank_name,'type',b.account_type,'currency',b.currency,
      'gl_account_id',b.gl_account_id,'book_balance',b.book_balance,
      'shared_ledger',coalesce(g.bank_account_count>1,false),
      'ledger_balance',CASE WHEN g.bank_account_count=1 THEN g.ledger_balance ELSE NULL END,
      'difference',CASE WHEN g.bank_account_count=1 AND g.ledger_balance IS NOT NULL THEN b.book_balance-g.ledger_balance ELSE NULL END,
      'reconciliation_status',CASE WHEN g.ledger_balance IS NULL THEN 'unlinked_or_unavailable_ledger' WHEN g.bank_account_count>1 THEN 'shared_ledger_see_group' WHEN abs(b.book_balance-g.ledger_balance)>0.005 THEN 'needs_reconciliation' ELSE 'balanced' END
    ) ORDER BY b.account_name) FROM banks b LEFT JOIN groups g ON g.gl_account_id=b.gl_account_id),'[]'::jsonb),
    'ledger_groups',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'gl_account_id',g.gl_account_id,'account_code',g.account_code,'ledger_account',g.ledger_account,
      'bank_accounts',g.bank_accounts,'bank_account_count',g.bank_account_count,
      'book_balance',g.book_balance,'ledger_balance',g.ledger_balance,
      'difference',g.book_balance-g.ledger_balance,
      'reconciliation_status',CASE WHEN g.ledger_balance IS NULL THEN 'unavailable_ledger' WHEN abs(g.book_balance-g.ledger_balance)>0.005 THEN 'needs_reconciliation' ELSE 'balanced' END
    ) ORDER BY g.account_code) FROM groups g),'[]'::jsonb),
    'unlinked_book_balance',(SELECT coalesce(sum(b.book_balance),0) FROM banks b WHERE b.gl_account_id IS NULL),
    'note','The ledger total counts each distinct linked ledger account once. When bank records share a ledger, only the combined group can be reconciled; no individual bank ledger balance can be inferred. Book balances are internal records, not verified bank statement balances. Differences require reconciliation; do not assume missing entries or alter balances to force agreement.',
    'as_of',now(),'source_last_changed_at',public.ai_journal_last_change(v_org)
  ) INTO r;
  RETURN r;
END $function$;
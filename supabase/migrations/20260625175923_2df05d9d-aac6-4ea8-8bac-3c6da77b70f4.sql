
CREATE OR REPLACE FUNCTION public.prevent_gl_account_delete_with_txns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM gl_journal_lines WHERE account_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete account %: it has posted journal lines. Disable it instead.', OLD.account_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM gl_account_balances WHERE account_id = OLD.id AND (debit_total > 0 OR credit_total > 0)) THEN
    RAISE EXCEPTION 'Cannot delete account %: it has account balances. Disable it instead.', OLD.account_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM gl_accounts WHERE parent_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete account %: it has child accounts.', OLD.account_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_gl_account_delete_with_txns ON public.gl_accounts;
CREATE TRIGGER trg_prevent_gl_account_delete_with_txns
BEFORE DELETE ON public.gl_accounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_gl_account_delete_with_txns();

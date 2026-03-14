
-- Add status column to gl_accounts with default 'approved' for existing records
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gl_accounts' AND column_name = 'status') THEN
    ALTER TABLE public.gl_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
  END IF;
END $$;

-- Create a function to check if a GL account has any transactions
CREATE OR REPLACE FUNCTION public.gl_account_has_transactions(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM gl_journal_lines WHERE account_id = p_account_id
    UNION ALL
    SELECT 1 FROM gl_account_balances WHERE account_id = p_account_id AND (debit_total > 0 OR credit_total > 0)
  );
$$;

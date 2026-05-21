
-- Extend budgets table
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Extend budget_lines to support department + account + quarterly split
ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS annual_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q3 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS q4 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_amount numeric NOT NULL DEFAULT 0;

-- Make legacy category optional + drop unique constraint to allow dept+account composite
ALTER TABLE public.budget_lines ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.budget_lines ALTER COLUMN category SET DEFAULT '';
ALTER TABLE public.budget_lines DROP CONSTRAINT IF EXISTS budget_lines_budget_id_category_key;
CREATE INDEX IF NOT EXISTS idx_budget_lines_dept_acct ON public.budget_lines(budget_id, department_id, account_id);

-- New budget_transactions table per spec
CREATE TABLE IF NOT EXISTS public.budget_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id uuid NOT NULL REFERENCES public.budget_lines(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('commit','uncommit','actual','reverse')),
  reference_type text,
  reference_id uuid,
  amount numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_budget_tx_line ON public.budget_transactions(budget_line_id);
CREATE INDEX IF NOT EXISTS idx_budget_tx_ref ON public.budget_transactions(reference_type, reference_id);

ALTER TABLE public.budget_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org budget_transactions" ON public.budget_transactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.budget_lines bl JOIN public.budgets b ON b.id = bl.budget_id
            WHERE bl.id = budget_transactions.budget_line_id AND b.organization_id = get_user_org_id())
  );

CREATE POLICY "Auth users can insert org budget_transactions" ON public.budget_transactions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.budget_lines bl JOIN public.budgets b ON b.id = bl.budget_id
            WHERE bl.id = budget_transactions.budget_line_id AND b.organization_id = get_user_org_id())
  );

-- Aggregate function: recalc committed/actual on budget_lines from budget_transactions
CREATE OR REPLACE FUNCTION public.recalc_budget_line_totals(p_line_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.budget_lines bl SET
    committed_amount = COALESCE((
      SELECT SUM(CASE WHEN transaction_type = 'commit' THEN amount
                      WHEN transaction_type = 'uncommit' THEN -amount
                      ELSE 0 END)
      FROM public.budget_transactions WHERE budget_line_id = p_line_id), 0),
    actual_amount = COALESCE((
      SELECT SUM(CASE WHEN transaction_type = 'actual' THEN amount
                      WHEN transaction_type = 'reverse' THEN -amount
                      ELSE 0 END)
      FROM public.budget_transactions WHERE budget_line_id = p_line_id), 0)
  WHERE bl.id = p_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_budget_tx_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_budget_line_totals(COALESCE(NEW.budget_line_id, OLD.budget_line_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_tx_recalc ON public.budget_transactions;
CREATE TRIGGER trg_budget_tx_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.budget_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_budget_tx_recalc();

-- Flag PO when over budget
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS over_budget boolean NOT NULL DEFAULT false;

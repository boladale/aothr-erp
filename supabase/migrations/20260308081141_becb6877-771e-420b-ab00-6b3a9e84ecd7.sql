
-- ==========================================
-- CASH MANAGEMENT MODULE
-- ==========================================

-- Bank Accounts
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    gl_account_id UUID REFERENCES public.gl_accounts(id),
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank Transactions (statement lines for reconciliation)
CREATE TYPE public.bank_txn_type AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'fee', 'interest');
CREATE TYPE public.bank_txn_status AS ENUM ('unreconciled', 'reconciled', 'voided');

CREATE TABLE public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    value_date DATE,
    transaction_type bank_txn_type NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    reference TEXT,
    payee TEXT,
    status bank_txn_status NOT NULL DEFAULT 'unreconciled',
    gl_journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
    reconciliation_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank Reconciliations
CREATE TYPE public.reconciliation_status AS ENUM ('in_progress', 'completed');

CREATE TABLE public.bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
    reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    statement_start_date DATE NOT NULL,
    statement_end_date DATE NOT NULL,
    statement_ending_balance NUMERIC NOT NULL,
    gl_balance NUMERIC NOT NULL DEFAULT 0,
    reconciled_balance NUMERIC NOT NULL DEFAULT 0,
    difference NUMERIC NOT NULL DEFAULT 0,
    status reconciliation_status NOT NULL DEFAULT 'in_progress',
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from bank_transactions to reconciliations
ALTER TABLE public.bank_transactions 
    ADD CONSTRAINT bank_transactions_reconciliation_id_fkey 
    FOREIGN KEY (reconciliation_id) REFERENCES public.bank_reconciliations(id);

-- Fund Transfers
CREATE TYPE public.fund_transfer_status AS ENUM ('draft', 'posted');

CREATE TABLE public.fund_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    from_bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
    to_bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
    amount NUMERIC NOT NULL,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    notes TEXT,
    status fund_transfer_status NOT NULL DEFAULT 'draft',
    gl_journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Auth users can view bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance can manage bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view bank_transactions" ON public.bank_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance can manage bank_transactions" ON public.bank_transactions FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

CREATE POLICY "Auth users can view bank_reconciliations" ON public.bank_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance can manage bank_reconciliations" ON public.bank_reconciliations FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view fund_transfers" ON public.fund_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance can manage fund_transfers" ON public.fund_transfers FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- Updated_at triggers
CREATE TRIGGER trg_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fund Transfer GL posting trigger
CREATE OR REPLACE FUNCTION public.gl_post_fund_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_from_gl UUID;
    v_to_gl UUID;
    v_from_name TEXT;
    v_to_name TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.transfer_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT gl_account_id, account_name INTO v_from_gl, v_from_name FROM bank_accounts WHERE id = NEW.from_bank_account_id;
        SELECT gl_account_id, account_name INTO v_to_gl, v_to_name FROM bank_accounts WHERE id = NEW.to_bank_account_id;
        
        IF v_from_gl IS NULL OR v_to_gl IS NULL THEN
            RAISE EXCEPTION 'Bank accounts must be linked to GL accounts for fund transfers.';
        END IF;
        
        v_entry_number := 'FT-' || NEW.transfer_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.transfer_date, 'Fund Transfer: ' || v_from_name || ' → ' || v_to_name, 'cash_management', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: To bank account
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_to_gl, NEW.amount, 0, 'Transfer in from ' || v_from_name);
        
        -- CR: From bank account
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_from_gl, 0, NEW.amount, 'Transfer out to ' || v_to_name);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        NEW.gl_journal_entry_id := v_entry_id;
        
        -- Update bank balances
        UPDATE bank_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_bank_account_id;
        UPDATE bank_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_bank_account_id;
        
        -- Create bank transactions for both sides
        INSERT INTO bank_transactions (bank_account_id, transaction_date, transaction_type, amount, description, reference, created_by)
        VALUES 
            (NEW.from_bank_account_id, NEW.transfer_date, 'transfer_out', -NEW.amount, 'Transfer to ' || v_to_name, NEW.transfer_number, auth.uid()),
            (NEW.to_bank_account_id, NEW.transfer_date, 'transfer_in', NEW.amount, 'Transfer from ' || v_from_name, NEW.transfer_number, auth.uid());
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_fund_transfer
    BEFORE UPDATE ON public.fund_transfers
    FOR EACH ROW EXECUTE FUNCTION public.gl_post_fund_transfer();

-- Prevent un-posting fund transfers
CREATE TRIGGER trg_prevent_fund_transfer_unpost
    BEFORE UPDATE ON public.fund_transfers
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ar_unpost();

-- Seed a default bank account linked to GL 1200
INSERT INTO public.bank_accounts (account_code, account_name, bank_name, gl_account_id)
SELECT 'BANK-001', 'Main Operating Account', 'Primary Bank', id
FROM public.gl_accounts WHERE account_code = '1200'
ON CONFLICT (account_code) DO NOTHING;

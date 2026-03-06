
-- =============================================
-- GENERAL LEDGER FOUNDATION SCHEMA
-- =============================================

-- Enum for GL account types
CREATE TYPE public.gl_account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Enum for GL entry status
CREATE TYPE public.gl_entry_status AS ENUM ('draft', 'posted', 'reversed');

-- Enum for fiscal period status
CREATE TYPE public.fiscal_period_status AS ENUM ('open', 'closed', 'locked');

-- =============================================
-- 1. Chart of Accounts
-- =============================================
CREATE TABLE public.gl_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_code TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type gl_account_type NOT NULL,
    parent_id UUID REFERENCES public.gl_accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_header BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    normal_balance TEXT NOT NULL DEFAULT 'debit',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 2. Fiscal Periods
-- =============================================
CREATE TABLE public.gl_fiscal_periods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    period_name TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    period_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status fiscal_period_status NOT NULL DEFAULT 'open',
    closed_by UUID,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(fiscal_year, period_number)
);

-- =============================================
-- 3. Journal Entries (Header)
-- =============================================
CREATE TABLE public.gl_journal_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_number TEXT NOT NULL UNIQUE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fiscal_period_id UUID REFERENCES public.gl_fiscal_periods(id),
    description TEXT,
    source_module TEXT,
    source_id UUID,
    status gl_entry_status NOT NULL DEFAULT 'draft',
    total_debit NUMERIC NOT NULL DEFAULT 0,
    total_credit NUMERIC NOT NULL DEFAULT 0,
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID,
    reversed_entry_id UUID REFERENCES public.gl_journal_entries(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 4. Journal Entry Lines
-- =============================================
CREATE TABLE public.gl_journal_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    journal_entry_id UUID NOT NULL REFERENCES public.gl_journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id UUID NOT NULL REFERENCES public.gl_accounts(id),
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 5. GL Account Balances (Materialized for performance)
-- =============================================
CREATE TABLE public.gl_account_balances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES public.gl_accounts(id),
    fiscal_period_id UUID NOT NULL REFERENCES public.gl_fiscal_periods(id),
    debit_total NUMERIC NOT NULL DEFAULT 0,
    credit_total NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(account_id, fiscal_period_id)
);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_account_balances ENABLE ROW LEVEL SECURITY;

-- GL Accounts: All auth users can view, admin + accounts_payable can manage
CREATE POLICY "Auth users can view gl_accounts" ON public.gl_accounts FOR SELECT USING (true);
CREATE POLICY "Finance roles can manage gl_accounts" ON public.gl_accounts FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role));

-- Fiscal Periods
CREATE POLICY "Auth users can view gl_fiscal_periods" ON public.gl_fiscal_periods FOR SELECT USING (true);
CREATE POLICY "Admin can manage gl_fiscal_periods" ON public.gl_fiscal_periods FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Journal Entries
CREATE POLICY "Auth users can view gl_journal_entries" ON public.gl_journal_entries FOR SELECT USING (true);
CREATE POLICY "Finance roles can manage gl_journal_entries" ON public.gl_journal_entries FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role));

-- Journal Lines
CREATE POLICY "Auth users can view gl_journal_lines" ON public.gl_journal_lines FOR SELECT USING (true);
CREATE POLICY "Finance roles can manage gl_journal_lines" ON public.gl_journal_lines FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role));

-- Account Balances
CREATE POLICY "Auth users can view gl_account_balances" ON public.gl_account_balances FOR SELECT USING (true);
CREATE POLICY "System can manage gl_account_balances" ON public.gl_account_balances FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role));

-- =============================================
-- Database Functions
-- =============================================

-- Enforce balanced journal entries on post
CREATE OR REPLACE FUNCTION public.enforce_balanced_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_period_status fiscal_period_status;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Check balanced
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
        INTO v_total_debit, v_total_credit
        FROM gl_journal_lines WHERE journal_entry_id = NEW.id;
        
        IF v_total_debit != v_total_credit THEN
            RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', v_total_debit, v_total_credit;
        END IF;
        
        IF v_total_debit = 0 THEN
            RAISE EXCEPTION 'Journal entry has no lines';
        END IF;
        
        -- Check fiscal period is open
        IF NEW.fiscal_period_id IS NOT NULL THEN
            SELECT status INTO v_period_status FROM gl_fiscal_periods WHERE id = NEW.fiscal_period_id;
            IF v_period_status != 'open' THEN
                RAISE EXCEPTION 'Cannot post to a % fiscal period', v_period_status;
            END IF;
        END IF;
        
        -- Set posted metadata
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        NEW.total_debit := v_total_debit;
        NEW.total_credit := v_total_credit;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_balanced_journal
    BEFORE UPDATE ON public.gl_journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.enforce_balanced_journal_entry();

-- Update account balances on journal post
CREATE OR REPLACE FUNCTION public.update_gl_account_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Upsert account balances for each line
        INSERT INTO gl_account_balances (account_id, fiscal_period_id, debit_total, credit_total, balance)
        SELECT 
            jl.account_id,
            NEW.fiscal_period_id,
            SUM(jl.debit),
            SUM(jl.credit),
            SUM(CASE 
                WHEN ga.normal_balance = 'debit' THEN jl.debit - jl.credit
                ELSE jl.credit - jl.debit
            END)
        FROM gl_journal_lines jl
        JOIN gl_accounts ga ON ga.id = jl.account_id
        WHERE jl.journal_entry_id = NEW.id
        GROUP BY jl.account_id
        ON CONFLICT (account_id, fiscal_period_id) DO UPDATE SET
            debit_total = gl_account_balances.debit_total + EXCLUDED.debit_total,
            credit_total = gl_account_balances.credit_total + EXCLUDED.credit_total,
            balance = gl_account_balances.balance + EXCLUDED.balance,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_gl_balances
    AFTER UPDATE ON public.gl_journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_gl_account_balances();

-- Prevent modification of posted journal entries
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_status gl_entry_status;
BEGIN
    SELECT status INTO v_entry_status FROM gl_journal_entries WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
    
    IF v_entry_status = 'posted' THEN
        RAISE EXCEPTION 'Cannot modify lines of a posted journal entry';
    END IF;
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_posted_journal_line_edit
    BEFORE INSERT OR UPDATE OR DELETE ON public.gl_journal_lines
    FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_journal_edit();

-- Audit trigger for journal entries
CREATE TRIGGER trg_audit_gl_journal_entries
    AFTER INSERT OR UPDATE OR DELETE ON public.gl_journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Updated_at trigger
CREATE TRIGGER trg_updated_at_gl_accounts
    BEFORE UPDATE ON public.gl_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_gl_journal_entries
    BEFORE UPDATE ON public.gl_journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

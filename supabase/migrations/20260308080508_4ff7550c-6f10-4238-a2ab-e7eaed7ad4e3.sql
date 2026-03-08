
-- ==========================================
-- ACCOUNTS RECEIVABLE MODULE
-- ==========================================

-- Customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    payment_terms INTEGER DEFAULT 30,
    credit_limit NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AR Invoices (Sales Invoices)
CREATE TYPE public.ar_invoice_status AS ENUM ('draft', 'posted', 'void');
CREATE TYPE public.ar_payment_status AS ENUM ('unpaid', 'partial', 'paid');

CREATE TABLE public.ar_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status ar_invoice_status NOT NULL DEFAULT 'draft',
    payment_status ar_payment_status NOT NULL DEFAULT 'unpaid',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AR Invoice Lines
CREATE TABLE public.ar_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id),
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    revenue_account_id UUID REFERENCES public.gl_accounts(id)
);

-- AR Receipts (Customer Payments)
CREATE TABLE public.ar_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    reference_number TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AR Receipt Allocations
CREATE TABLE public.ar_receipt_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.ar_receipts(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.ar_invoices(id),
    allocated_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AR Credit Notes
CREATE TYPE public.ar_credit_note_status AS ENUM ('draft', 'posted', 'void');

CREATE TABLE public.ar_credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    invoice_id UUID REFERENCES public.ar_invoices(id),
    credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status ar_credit_note_status NOT NULL DEFAULT 'draft',
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    reason TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AR Credit Note Lines
CREATE TABLE public.ar_credit_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID NOT NULL REFERENCES public.ar_credit_notes(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id),
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Revenue Recognition
CREATE TYPE public.revenue_schedule_status AS ENUM ('active', 'completed', 'cancelled');

CREATE TABLE public.revenue_recognition_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_invoice_line_id UUID NOT NULL REFERENCES public.ar_invoice_lines(id),
    total_amount NUMERIC NOT NULL,
    recognized_amount NUMERIC NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    schedule_type TEXT NOT NULL DEFAULT 'straight_line',
    status revenue_schedule_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.revenue_recognition_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.revenue_recognition_schedules(id),
    fiscal_period_id UUID REFERENCES public.gl_fiscal_periods(id),
    amount NUMERIC NOT NULL,
    recognized_date DATE NOT NULL,
    journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
    posted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_recognition_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_recognition_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Customers
CREATE POLICY "Auth users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage customers" ON public.customers FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Invoices
CREATE POLICY "Auth users can view ar_invoices" ON public.ar_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_invoices" ON public.ar_invoices FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Invoice Lines
CREATE POLICY "Auth users can view ar_invoice_lines" ON public.ar_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_invoice_lines" ON public.ar_invoice_lines FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Receipts
CREATE POLICY "Auth users can view ar_receipts" ON public.ar_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_receipts" ON public.ar_receipts FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Receipt Allocations
CREATE POLICY "Auth users can view ar_receipt_allocations" ON public.ar_receipt_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_receipt_allocations" ON public.ar_receipt_allocations FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Credit Notes
CREATE POLICY "Auth users can view ar_credit_notes" ON public.ar_credit_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_credit_notes" ON public.ar_credit_notes FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: AR Credit Note Lines
CREATE POLICY "Auth users can view ar_credit_note_lines" ON public.ar_credit_note_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage ar_credit_note_lines" ON public.ar_credit_note_lines FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS Policies: Revenue Recognition
CREATE POLICY "Auth users can view rev_rec_schedules" ON public.revenue_recognition_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage rev_rec_schedules" ON public.revenue_recognition_schedules FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view rev_rec_entries" ON public.revenue_recognition_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage rev_rec_entries" ON public.revenue_recognition_entries FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

-- Seed AR GL accounts (if not existing)
INSERT INTO public.gl_accounts (account_code, account_name, account_type, parent_id, is_header, normal_balance, description) 
VALUES 
    ('1300', 'Accounts Receivable', 'asset', NULL, false, 'debit', 'Trade receivables from customers'),
    ('4100', 'Sales Revenue - Services', 'revenue', NULL, false, 'credit', 'Revenue from services rendered'),
    ('4200', 'Sales Revenue - Products', 'revenue', NULL, false, 'credit', 'Revenue from product sales'),
    ('4900', 'Deferred Revenue', 'liability', NULL, false, 'credit', 'Revenue recognized over time')
ON CONFLICT (account_code) DO NOTHING;

-- ==========================================
-- GL AUTO-POSTING TRIGGERS
-- ==========================================

-- AR Invoice -> GL (DR: Accounts Receivable / CR: Revenue)
CREATE OR REPLACE FUNCTION public.gl_post_ar_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ar_account_id UUID;
    v_default_revenue_id UUID;
    v_line_num INT := 0;
    v_inv_line RECORD;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.invoice_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_ar_account_id FROM gl_accounts WHERE account_code = '1300' AND is_active = true;
        SELECT id INTO v_default_revenue_id FROM gl_accounts WHERE account_code = '4100' AND is_active = true;
        
        IF v_ar_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1300 - Accounts Receivable" not found.';
        END IF;
        
        v_entry_number := 'AR-INV-' || NEW.invoice_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.invoice_date, 'AR Invoice: ' || NEW.invoice_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Accounts Receivable (total)
        v_line_num := 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_ar_account_id, COALESCE(NEW.total_amount, 0), 0, 'Accounts Receivable - ' || NEW.invoice_number);
        
        -- CR: Revenue for each line
        FOR v_inv_line IN 
            SELECT line_total, revenue_account_id FROM ar_invoice_lines WHERE invoice_id = NEW.id
        LOOP
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, COALESCE(v_inv_line.revenue_account_id, v_default_revenue_id), 0, COALESCE(v_inv_line.line_total, 0), 'Revenue');
        END LOOP;
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_ar_invoice
    BEFORE UPDATE ON public.ar_invoices
    FOR EACH ROW EXECUTE FUNCTION public.gl_post_ar_invoice();

-- AR Receipt -> GL (DR: Bank / CR: Accounts Receivable)
CREATE OR REPLACE FUNCTION public.gl_post_ar_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ar_account_id UUID;
    v_bank_account_id UUID;
    v_customer_name TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.receipt_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_ar_account_id FROM gl_accounts WHERE account_code = '1300' AND is_active = true;
        SELECT id INTO v_bank_account_id FROM gl_accounts WHERE account_code = '1200' AND is_active = true;
        SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
        
        IF v_ar_account_id IS NULL OR v_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Required GL accounts (1300, 1200) not found.';
        END IF;
        
        v_entry_number := 'AR-REC-' || NEW.receipt_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.receipt_date, 'AR Receipt from ' || v_customer_name || ': ' || NEW.receipt_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Bank
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_bank_account_id, NEW.total_amount, 0, 'Bank receipt - ' || NEW.receipt_number);
        
        -- CR: Accounts Receivable
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_ar_account_id, 0, NEW.total_amount, 'Clear AR - ' || v_customer_name);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        -- Update invoice payment statuses
        UPDATE ar_invoices SET payment_status = 
            CASE 
                WHEN (SELECT COALESCE(SUM(ara.allocated_amount), 0) 
                      FROM ar_receipt_allocations ara 
                      JOIN ar_receipts ar ON ar.id = ara.receipt_id 
                      WHERE ara.invoice_id = ar_invoices.id AND ar.status = 'posted') >= COALESCE(ar_invoices.total_amount, 0)
                THEN 'paid'::ar_payment_status
                WHEN (SELECT COALESCE(SUM(ara.allocated_amount), 0) 
                      FROM ar_receipt_allocations ara 
                      JOIN ar_receipts ar ON ar.id = ara.receipt_id 
                      WHERE ara.invoice_id = ar_invoices.id AND ar.status = 'posted') > 0
                THEN 'partial'::ar_payment_status
                ELSE 'unpaid'::ar_payment_status
            END
        WHERE id IN (SELECT invoice_id FROM ar_receipt_allocations WHERE receipt_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_ar_receipt
    BEFORE UPDATE ON public.ar_receipts
    FOR EACH ROW EXECUTE FUNCTION public.gl_post_ar_receipt();

-- AR Credit Note -> GL (DR: Revenue / CR: Accounts Receivable)
CREATE OR REPLACE FUNCTION public.gl_post_ar_credit_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ar_account_id UUID;
    v_revenue_account_id UUID;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.credit_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_ar_account_id FROM gl_accounts WHERE account_code = '1300' AND is_active = true;
        SELECT id INTO v_revenue_account_id FROM gl_accounts WHERE account_code = '4100' AND is_active = true;
        
        v_entry_number := 'AR-CN-' || NEW.credit_note_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.credit_date, 'Credit Note: ' || NEW.credit_note_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Revenue (reverse)
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_revenue_account_id, COALESCE(NEW.total_amount, 0), 0, 'Revenue reversal - CN ' || NEW.credit_note_number);
        
        -- CR: Accounts Receivable
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_ar_account_id, 0, COALESCE(NEW.total_amount, 0), 'AR reduction - CN ' || NEW.credit_note_number);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        -- If linked to an invoice, reduce the invoice's effective amount for payment status
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE ar_invoices SET payment_status = 
                CASE 
                    WHEN COALESCE(total_amount, 0) - (SELECT COALESCE(SUM(cn.total_amount), 0) FROM ar_credit_notes cn WHERE cn.invoice_id = NEW.invoice_id AND cn.status = 'posted') <= 
                         (SELECT COALESCE(SUM(ara.allocated_amount), 0) FROM ar_receipt_allocations ara JOIN ar_receipts ar ON ar.id = ara.receipt_id WHERE ara.invoice_id = NEW.invoice_id AND ar.status = 'posted')
                    THEN 'paid'::ar_payment_status
                    ELSE payment_status
                END
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_ar_credit_note
    BEFORE UPDATE ON public.ar_credit_notes
    FOR EACH ROW EXECUTE FUNCTION public.gl_post_ar_credit_note();

-- Prevent un-posting
CREATE OR REPLACE FUNCTION public.prevent_ar_unpost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot un-post a posted document';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_ar_invoice_unpost BEFORE UPDATE ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION public.prevent_ar_unpost();
CREATE TRIGGER trg_prevent_ar_receipt_unpost BEFORE UPDATE ON public.ar_receipts FOR EACH ROW EXECUTE FUNCTION public.prevent_ar_unpost();
CREATE TRIGGER trg_prevent_ar_credit_note_unpost BEFORE UPDATE ON public.ar_credit_notes FOR EACH ROW EXECUTE FUNCTION public.prevent_ar_unpost();

-- Updated_at triggers
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ar_invoices_updated_at BEFORE UPDATE ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ar_receipts_updated_at BEFORE UPDATE ON public.ar_receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ar_credit_notes_updated_at BEFORE UPDATE ON public.ar_credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint on gl_account_balances if not exists
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gl_account_balances_account_period_unique') THEN
        ALTER TABLE public.gl_account_balances ADD CONSTRAINT gl_account_balances_account_period_unique UNIQUE (account_id, fiscal_period_id);
    END IF;
END $$;

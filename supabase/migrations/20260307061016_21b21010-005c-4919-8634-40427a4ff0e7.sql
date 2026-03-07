
-- AP Payments table
CREATE TABLE public.ap_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_number TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    reference_number TEXT,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AP Payment Allocations (links payments to invoices)
CREATE TABLE public.ap_payment_allocations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES public.ap_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.ap_invoices(id),
    allocated_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add payment_status to ap_invoices
ALTER TABLE public.ap_invoices ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- Enable RLS
ALTER TABLE public.ap_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_payment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS for ap_payments
CREATE POLICY "Auth users can view ap_payments" ON public.ap_payments FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage ap_payments" ON public.ap_payments FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role));

-- RLS for ap_payment_allocations
CREATE POLICY "Auth users can view ap_payment_allocations" ON public.ap_payment_allocations FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage ap_payment_allocations" ON public.ap_payment_allocations FOR ALL 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts_payable'::app_role) OR has_role(auth.uid(), 'ap_clerk'::app_role));

-- Trigger: Auto-post GL journal entry when AP invoice is posted
-- DR: GR/IR Clearing (or Expense) / CR: Accounts Payable
CREATE OR REPLACE FUNCTION public.gl_post_ap_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ap_account_id UUID;
    v_expense_account_id UUID;
    v_line_num INT := 0;
    v_inv_line RECORD;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Find fiscal period
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.invoice_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        -- Get AP liability account (2100 - Accounts Payable)
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        -- Get default expense account (5100 - Cost of Goods Sold)
        SELECT id INTO v_expense_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        
        IF v_ap_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "2100 - Accounts Payable" not found. Please set up Chart of Accounts.';
        END IF;
        
        -- Generate entry number
        v_entry_number := 'AP-INV-' || NEW.invoice_number;
        
        -- Create journal entry
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.invoice_date, 'AP Invoice: ' || NEW.invoice_number, 'accounts_payable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Expense/COGS for each line
        FOR v_inv_line IN 
            SELECT line_total FROM ap_invoice_lines WHERE invoice_id = NEW.id
        LOOP
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_expense_account_id, COALESCE(v_inv_line.line_total, 0), 0, 'Invoice line expense');
        END LOOP;
        
        -- CR: Accounts Payable (total)
        v_line_num := v_line_num + 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_ap_account_id, 0, COALESCE(NEW.total_amount, 0), 'Accounts Payable - ' || NEW.invoice_number);
        
        -- Post the journal entry
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_ap_invoice
    AFTER UPDATE ON public.ap_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.gl_post_ap_invoice();

-- Trigger: Auto-post GL journal entry when AP payment is posted
-- DR: Accounts Payable / CR: Bank/Cash
CREATE OR REPLACE FUNCTION public.gl_post_ap_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ap_account_id UUID;
    v_bank_account_id UUID;
    v_vendor_name TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        -- Find fiscal period
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.payment_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        -- Get accounts
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        SELECT id INTO v_bank_account_id FROM gl_accounts WHERE account_code = '1200' AND is_active = true;
        SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;
        
        IF v_ap_account_id IS NULL OR v_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Required GL accounts (2100, 1200) not found. Please set up Chart of Accounts.';
        END IF;
        
        v_entry_number := 'AP-PAY-' || NEW.payment_number;
        
        -- Create and post journal entry
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.payment_date, 'AP Payment to ' || v_vendor_name || ': ' || NEW.payment_number, 'accounts_payable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Accounts Payable
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_ap_account_id, NEW.total_amount, 0, 'Clear AP - ' || v_vendor_name);
        
        -- CR: Bank/Cash
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_bank_account_id, 0, NEW.total_amount, 'Bank payment - ' || NEW.payment_number);
        
        -- Post the journal entry
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        -- Update invoice payment statuses
        UPDATE ap_invoices SET payment_status = 
            CASE 
                WHEN (SELECT COALESCE(SUM(apa.allocated_amount), 0) 
                      FROM ap_payment_allocations apa 
                      JOIN ap_payments ap ON ap.id = apa.payment_id 
                      WHERE apa.invoice_id = ap_invoices.id AND ap.status = 'posted') >= COALESCE(ap_invoices.total_amount, 0)
                THEN 'paid'
                WHEN (SELECT COALESCE(SUM(apa.allocated_amount), 0) 
                      FROM ap_payment_allocations apa 
                      JOIN ap_payments ap ON ap.id = apa.payment_id 
                      WHERE apa.invoice_id = ap_invoices.id AND ap.status = 'posted') > 0
                THEN 'partial'
                ELSE 'unpaid'
            END
        WHERE id IN (SELECT invoice_id FROM ap_payment_allocations WHERE payment_id = NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_ap_payment
    BEFORE UPDATE ON public.ap_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.gl_post_ap_payment();

-- Prevent un-posting payments
CREATE OR REPLACE FUNCTION public.prevent_double_post_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status != 'posted' THEN
        RAISE EXCEPTION 'Cannot un-post a payment. Payment: %', OLD.payment_number;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_double_post_payment
    BEFORE UPDATE ON public.ap_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_double_post_payment();

-- Updated_at trigger
CREATE TRIGGER trg_ap_payments_updated_at
    BEFORE UPDATE ON public.ap_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

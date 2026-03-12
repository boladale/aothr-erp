
-- Transaction counters table for collision-proof sequential numbering per org
CREATE TABLE public.transaction_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  prefix text NOT NULL,
  last_number bigint NOT NULL DEFAULT 0,
  UNIQUE(organization_id, document_type)
);

ALTER TABLE public.transaction_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON public.transaction_counters
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Atomic function to get next sequential number (no collisions)
CREATE OR REPLACE FUNCTION public.next_transaction_number(
  p_org_id uuid,
  p_doc_type text,
  p_prefix text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_next bigint;
  v_prefix text;
BEGIN
  INSERT INTO transaction_counters (organization_id, document_type, prefix, last_number)
  VALUES (p_org_id, p_doc_type, COALESCE(p_prefix, p_doc_type), 1)
  ON CONFLICT (organization_id, document_type)
  DO UPDATE SET last_number = transaction_counters.last_number + 1
  RETURNING last_number, prefix INTO v_next, v_prefix;
  
  RETURN v_prefix || '-' || LPAD(v_next::text, 5, '0');
END;
$$;

-- Fix triggers to pass organization_id to journal entries

-- Fix gl_post_ap_payment
CREATE OR REPLACE FUNCTION public.gl_post_ap_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.payment_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        SELECT id INTO v_bank_account_id FROM gl_accounts WHERE account_code = '1200' AND is_active = true;
        SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;
        
        IF v_ap_account_id IS NULL OR v_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Required GL accounts (2100, 1200) not found.';
        END IF;
        
        v_entry_number := 'AP-PAY-' || NEW.payment_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.payment_date, 'AP Payment to ' || v_vendor_name || ': ' || NEW.payment_number, 'accounts_payable', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_ap_account_id, NEW.total_amount, 0, 'Clear AP - ' || v_vendor_name);
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_bank_account_id, 0, NEW.total_amount, 'Bank payment - ' || NEW.payment_number);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        UPDATE ap_invoices SET payment_status = 
            CASE 
                WHEN (SELECT COALESCE(SUM(apa.allocated_amount), 0) FROM ap_payment_allocations apa JOIN ap_payments ap ON ap.id = apa.payment_id WHERE apa.invoice_id = ap_invoices.id AND ap.status = 'posted') >= COALESCE(ap_invoices.total_amount, 0) THEN 'paid'
                WHEN (SELECT COALESCE(SUM(apa.allocated_amount), 0) FROM ap_payment_allocations apa JOIN ap_payments ap ON ap.id = apa.payment_id WHERE apa.invoice_id = ap_invoices.id AND ap.status = 'posted') > 0 THEN 'partial'
                ELSE 'unpaid'
            END
        WHERE id IN (SELECT invoice_id FROM ap_payment_allocations WHERE payment_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Fix gl_post_ar_receipt
CREATE OR REPLACE FUNCTION public.gl_post_ar_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.receipt_date, 'AR Receipt from ' || v_customer_name || ': ' || NEW.receipt_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_bank_account_id, NEW.total_amount, 0, 'Bank receipt - ' || NEW.receipt_number);
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_ar_account_id, 0, NEW.total_amount, 'Clear AR - ' || v_customer_name);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        UPDATE ar_invoices SET payment_status = 
            CASE 
                WHEN (SELECT COALESCE(SUM(ara.allocated_amount), 0) FROM ar_receipt_allocations ara JOIN ar_receipts ar ON ar.id = ara.receipt_id WHERE ara.invoice_id = ar_invoices.id AND ar.status = 'posted') >= COALESCE(ar_invoices.total_amount, 0) THEN 'paid'::ar_payment_status
                WHEN (SELECT COALESCE(SUM(ara.allocated_amount), 0) FROM ar_receipt_allocations ara JOIN ar_receipts ar ON ar.id = ara.receipt_id WHERE ara.invoice_id = ar_invoices.id AND ar.status = 'posted') > 0 THEN 'partial'::ar_payment_status
                ELSE 'unpaid'::ar_payment_status
            END
        WHERE id IN (SELECT invoice_id FROM ar_receipt_allocations WHERE receipt_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- Fix gl_post_ar_credit_note
CREATE OR REPLACE FUNCTION public.gl_post_ar_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.credit_date, 'Credit Note: ' || NEW.credit_note_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_revenue_account_id, COALESCE(NEW.total_amount, 0), 0, 'Revenue reversal - CN ' || NEW.credit_note_number);
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_ar_account_id, 0, COALESCE(NEW.total_amount, 0), 'AR reduction - CN ' || NEW.credit_note_number);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
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

-- Fix gl_post_fund_transfer
CREATE OR REPLACE FUNCTION public.gl_post_fund_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.transfer_date, 'Fund Transfer: ' || v_from_name || ' → ' || v_to_name, 'cash_management', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_to_gl, NEW.amount, 0, 'Transfer in from ' || v_from_name);
        
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_from_gl, 0, NEW.amount, 'Transfer out to ' || v_to_name);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        NEW.gl_journal_entry_id := v_entry_id;
        
        UPDATE bank_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_bank_account_id;
        UPDATE bank_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_bank_account_id;
        
        INSERT INTO bank_transactions (bank_account_id, transaction_date, transaction_type, amount, description, reference, created_by, organization_id)
        VALUES 
            (NEW.from_bank_account_id, NEW.transfer_date, 'transfer_out', -NEW.amount, 'Transfer to ' || v_to_name, NEW.transfer_number, auth.uid(), NEW.organization_id),
            (NEW.to_bank_account_id, NEW.transfer_date, 'transfer_in', NEW.amount, 'Transfer from ' || v_from_name, NEW.transfer_number, auth.uid(), NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Fix gl_post_ap_invoice
CREATE OR REPLACE FUNCTION public.gl_post_ap_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ap_account_id UUID;
    v_default_expense_id UUID;
    v_input_tax_account_id UUID;
    v_line_num INT := 0;
    v_inv_line RECORD;
    v_lines_total NUMERIC := 0;
    v_target_account UUID;
BEGIN
    IF NEW.status = 'posted' AND OLD.status IN ('draft', 'approved') THEN
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.invoice_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        SELECT id INTO v_default_expense_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_input_tax_account_id FROM gl_accounts WHERE account_code = '1500' AND is_active = true;
        
        IF v_ap_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "2100 - Accounts Payable" not found.';
        END IF;
        
        v_entry_number := 'AP-INV-' || NEW.invoice_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.invoice_date, 'AP Invoice: ' || NEW.invoice_number, 'accounts_payable', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        FOR v_inv_line IN 
            SELECT line_total, expense_account_id FROM ap_invoice_lines WHERE invoice_id = NEW.id
        LOOP
            v_line_num := v_line_num + 1;
            v_target_account := COALESCE(v_inv_line.expense_account_id, v_default_expense_id);
            v_lines_total := v_lines_total + COALESCE(v_inv_line.line_total, 0);
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_target_account, COALESCE(v_inv_line.line_total, 0), 0, 'Invoice line expense');
        END LOOP;
        
        IF COALESCE(NEW.tax_amount, 0) > 0 THEN
            IF v_input_tax_account_id IS NULL THEN
                RAISE EXCEPTION 'GL Account "1500 - Input Tax" not found.';
            END IF;
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_input_tax_account_id, NEW.tax_amount, 0, 'Input Tax - ' || NEW.invoice_number);
        END IF;
        
        v_line_num := v_line_num + 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_ap_account_id, 0, COALESCE(NEW.total_amount, 0), 'Accounts Payable - ' || NEW.invoice_number);
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Fix gl_post_inventory_adjustment
CREATE OR REPLACE FUNCTION public.gl_post_inventory_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_inventory_account_id UUID;
    v_cogs_account_id UUID;
    v_other_income_account_id UUID;
    v_line RECORD;
    v_line_num INT := 0;
    v_total_cost NUMERIC := 0;
    v_layer_cost NUMERIC;
    v_item_unit_cost NUMERIC;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.adjustment_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code = '1400' AND is_active = true;
        SELECT id INTO v_cogs_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_other_income_account_id FROM gl_accounts WHERE account_code = '4900' AND is_active = true;
        
        IF v_inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1400 - Inventory" not found.';
        END IF;
        
        v_entry_number := 'INV-ADJ-' || NEW.adjustment_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.adjustment_date, 'Inventory Adjustment: ' || NEW.adjustment_number, 'inventory', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        FOR v_line IN 
            SELECT id, item_id, adjustment_type, quantity FROM inventory_adjustment_lines WHERE adjustment_id = NEW.id
        LOOP
            IF v_line.adjustment_type = 'decrease' THEN
                v_layer_cost := consume_fifo_layers(v_line.item_id, NEW.location_id, v_line.quantity, 'adjustment', v_line.id);
                
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_cogs_account_id, v_layer_cost, 0, 'COGS - inventory adjustment');
                
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_inventory_account_id, 0, v_layer_cost, 'Inventory reduction');
                
                v_total_cost := v_total_cost + v_layer_cost;
            ELSE
                SELECT COALESCE(unit_cost, 0) INTO v_item_unit_cost FROM items WHERE id = v_line.item_id;
                
                INSERT INTO inventory_costing_layers (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost)
                VALUES (v_line.item_id, NEW.location_id, 'adjustment', v_line.id, NEW.adjustment_date, v_line.quantity, v_line.quantity, v_item_unit_cost);
                
                v_layer_cost := v_line.quantity * v_item_unit_cost;
                
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_inventory_account_id, v_layer_cost, 0, 'Inventory increase');
                
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, COALESCE(v_other_income_account_id, v_inventory_account_id), 0, v_layer_cost, 'Adjustment gain');
                
                v_total_cost := v_total_cost + v_layer_cost;
            END IF;
        END LOOP;
        
        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

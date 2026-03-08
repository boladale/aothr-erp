
-- Seed tax GL accounts
INSERT INTO gl_accounts (account_code, account_name, account_type, normal_balance, description, is_active, is_header)
VALUES 
  ('1500', 'Input Tax (VAT Receivable)', 'asset', 'debit', 'Tax paid on purchases, recoverable from tax authority', true, false),
  ('2300', 'Output Tax (VAT Payable)', 'liability', 'credit', 'Tax collected on sales, payable to tax authority', true, false)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- FIX: gl_post_ap_invoice - add Input Tax line
-- ============================================
CREATE OR REPLACE FUNCTION public.gl_post_ap_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ap_account_id UUID;
    v_expense_account_id UUID;
    v_input_tax_account_id UUID;
    v_line_num INT := 0;
    v_inv_line RECORD;
    v_lines_total NUMERIC := 0;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Find fiscal period
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.invoice_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        -- Get GL accounts
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        SELECT id INTO v_expense_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_input_tax_account_id FROM gl_accounts WHERE account_code = '1500' AND is_active = true;
        
        IF v_ap_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "2100 - Accounts Payable" not found. Please set up Chart of Accounts.';
        END IF;
        
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
            v_lines_total := v_lines_total + COALESCE(v_inv_line.line_total, 0);
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_expense_account_id, COALESCE(v_inv_line.line_total, 0), 0, 'Invoice line expense');
        END LOOP;
        
        -- DR: Input Tax (if any)
        IF COALESCE(NEW.tax_amount, 0) > 0 THEN
            IF v_input_tax_account_id IS NULL THEN
                RAISE EXCEPTION 'GL Account "1500 - Input Tax" not found. Please set up Chart of Accounts.';
            END IF;
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_input_tax_account_id, NEW.tax_amount, 0, 'Input Tax - ' || NEW.invoice_number);
        END IF;
        
        -- CR: Accounts Payable (total = lines + tax)
        v_line_num := v_line_num + 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_ap_account_id, 0, COALESCE(NEW.total_amount, 0), 'Accounts Payable - ' || NEW.invoice_number);
        
        -- Post the journal entry (enforce_balanced_journal_entry trigger validates)
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- ============================================
-- FIX: gl_post_ar_invoice - add Output Tax line
-- ============================================
CREATE OR REPLACE FUNCTION public.gl_post_ar_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_ar_account_id UUID;
    v_default_revenue_id UUID;
    v_output_tax_account_id UUID;
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
        SELECT id INTO v_output_tax_account_id FROM gl_accounts WHERE account_code = '2300' AND is_active = true;
        
        IF v_ar_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1300 - Accounts Receivable" not found.';
        END IF;
        
        v_entry_number := 'AR-INV-' || NEW.invoice_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.invoice_date, 'AR Invoice: ' || NEW.invoice_number, 'accounts_receivable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Accounts Receivable (total = lines + tax)
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
        
        -- CR: Output Tax (if any)
        IF COALESCE(NEW.tax_amount, 0) > 0 THEN
            IF v_output_tax_account_id IS NULL THEN
                RAISE EXCEPTION 'GL Account "2300 - Output Tax" not found. Please set up Chart of Accounts.';
            END IF;
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_output_tax_account_id, 0, NEW.tax_amount, 'Output Tax - ' || NEW.invoice_number);
        END IF;
        
        -- Post the journal entry (enforce_balanced_journal_entry trigger validates)
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
    END IF;
    RETURN NEW;
END;
$function$;

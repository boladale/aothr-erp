
-- Fix: GL trigger was only checking OLD.status = 'draft', but approval workflow means OLD.status = 'approved'
CREATE OR REPLACE FUNCTION public.gl_post_ap_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    IF NEW.status = 'posted' AND OLD.status IN ('draft', 'approved') THEN
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.invoice_date BETWEEN start_date AND end_date AND status = 'open'
        LIMIT 1;
        
        SELECT id INTO v_ap_account_id FROM gl_accounts WHERE account_code = '2100' AND is_active = true;
        SELECT id INTO v_expense_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_input_tax_account_id FROM gl_accounts WHERE account_code = '1500' AND is_active = true;
        
        IF v_ap_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "2100 - Accounts Payable" not found.';
        END IF;
        
        v_entry_number := 'AP-INV-' || NEW.invoice_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.invoice_date, 'AP Invoice: ' || NEW.invoice_number, 'accounts_payable', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        FOR v_inv_line IN 
            SELECT line_total FROM ap_invoice_lines WHERE invoice_id = NEW.id
        LOOP
            v_line_num := v_line_num + 1;
            v_lines_total := v_lines_total + COALESCE(v_inv_line.line_total, 0);
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_expense_account_id, COALESCE(v_inv_line.line_total, 0), 0, 'Invoice line expense');
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

-- Fix three-way match trigger too
CREATE OR REPLACE FUNCTION public.trigger_three_way_match_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_run_id UUID;
    v_exception_count INTEGER;
BEGIN
    IF NEW.status = 'posted' AND OLD.status IN ('draft', 'approved') THEN
        v_match_run_id := run_three_way_match(NEW.id);
        
        SELECT total_exceptions INTO v_exception_count
        FROM match_runs WHERE id = v_match_run_id;
        
        IF v_exception_count > 0 THEN
            INSERT INTO invoice_holds (invoice_id, hold_type, hold_reason, match_run_id)
            VALUES (NEW.id, 'match_exception', 'Three-way match failed with ' || v_exception_count || ' exception(s)', v_match_run_id);
            
            NEW.status := OLD.status;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

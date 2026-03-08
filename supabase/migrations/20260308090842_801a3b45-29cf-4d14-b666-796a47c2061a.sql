
-- Seed Retained Earnings account if not exists
INSERT INTO gl_accounts (account_code, account_name, account_type, normal_balance, description, is_active, is_header)
VALUES ('3200', 'Retained Earnings', 'equity', 'credit', 'Accumulated retained earnings from year-end close', true, false)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- FUNCTION: Period-End Summary Entry
-- Creates a summary JE capturing each account's period totals
-- ============================================
CREATE OR REPLACE FUNCTION public.gl_period_end_summary(p_period_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_period RECORD;
    v_entry_id UUID;
    v_entry_number TEXT;
    v_line_num INT := 0;
    v_bal RECORD;
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
BEGIN
    SELECT * INTO v_period FROM gl_fiscal_periods WHERE id = p_period_id;
    IF v_period IS NULL THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
    IF v_period.status != 'open' THEN RAISE EXCEPTION 'Period must be open to run period-end summary'; END IF;

    -- Check if summary already exists
    IF EXISTS (SELECT 1 FROM gl_journal_entries WHERE source_module = 'period_close' AND source_id = p_period_id::text AND status = 'posted') THEN
        RAISE EXCEPTION 'Period-end summary already exists for this period';
    END IF;

    v_entry_number := 'PER-CLOSE-' || v_period.fiscal_year || '-' || LPAD(v_period.period_number::text, 2, '0');

    -- Create summary journal entry (informational - balanced by design since it mirrors existing balances)
    INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
    VALUES (v_entry_number, v_period.end_date, 'Period-End Summary: ' || v_period.period_name, 'period_close', p_period_id::text, p_period_id, 'draft', auth.uid())
    RETURNING id INTO v_entry_id;

    -- Create summary lines from account balances for this period
    FOR v_bal IN
        SELECT gab.account_id, gab.debit_total, gab.credit_total, ga.account_name
        FROM gl_account_balances gab
        JOIN gl_accounts ga ON ga.id = gab.account_id
        WHERE gab.fiscal_period_id = p_period_id
        AND (gab.debit_total > 0 OR gab.credit_total > 0)
        ORDER BY ga.account_code
    LOOP
        v_line_num := v_line_num + 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_bal.account_id, v_bal.debit_total, v_bal.credit_total, 'Period summary - ' || v_bal.account_name);
        v_total_debit := v_total_debit + v_bal.debit_total;
        v_total_credit := v_total_credit + v_bal.credit_total;
    END LOOP;

    IF v_line_num = 0 THEN
        -- No activity, remove the empty entry
        DELETE FROM gl_journal_entries WHERE id = v_entry_id;
        RETURN NULL;
    END IF;

    -- Update totals and post
    UPDATE gl_journal_entries SET total_debit = v_total_debit, total_credit = v_total_credit, status = 'posted', posted_at = now(), posted_by = auth.uid() WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;

-- ============================================
-- FUNCTION: Year-End Close
-- Zeros out Revenue & Expense accounts into Retained Earnings
-- ============================================
CREATE OR REPLACE FUNCTION public.gl_year_end_close(p_fiscal_year int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_last_period_id UUID;
    v_last_period_end DATE;
    v_retained_earnings_id UUID;
    v_line_num INT := 0;
    v_acct RECORD;
    v_net_balance NUMERIC := 0;
    v_acct_balance NUMERIC;
BEGIN
    -- Get retained earnings account
    SELECT id INTO v_retained_earnings_id FROM gl_accounts WHERE account_code = '3200' AND is_active = true;
    IF v_retained_earnings_id IS NULL THEN
        RAISE EXCEPTION 'Retained Earnings account (3200) not found';
    END IF;

    -- Get last period of the fiscal year
    SELECT id, end_date INTO v_last_period_id, v_last_period_end
    FROM gl_fiscal_periods
    WHERE fiscal_year = p_fiscal_year
    ORDER BY period_number DESC LIMIT 1;

    IF v_last_period_id IS NULL THEN
        RAISE EXCEPTION 'No fiscal periods found for year %', p_fiscal_year;
    END IF;

    -- Check no year-end close already done
    IF EXISTS (SELECT 1 FROM gl_journal_entries WHERE source_module = 'year_end_close' AND source_id = p_fiscal_year::text AND status = 'posted') THEN
        RAISE EXCEPTION 'Year-end close already performed for fiscal year %', p_fiscal_year;
    END IF;

    v_entry_number := 'YE-CLOSE-' || p_fiscal_year;

    -- Create closing journal entry
    INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
    VALUES (v_entry_number, v_last_period_end, 'Year-End Close FY' || p_fiscal_year || ': Transfer P&L to Retained Earnings', 'year_end_close', p_fiscal_year::text, v_last_period_id, 'draft', auth.uid())
    RETURNING id INTO v_entry_id;

    -- For each revenue/expense account, calculate total balance across all periods of the year
    FOR v_acct IN
        SELECT ga.id, ga.account_code, ga.account_name, ga.account_type, ga.normal_balance,
               COALESCE(SUM(gab.debit_total), 0) AS total_debits,
               COALESCE(SUM(gab.credit_total), 0) AS total_credits
        FROM gl_accounts ga
        LEFT JOIN gl_account_balances gab ON gab.account_id = ga.id
        LEFT JOIN gl_fiscal_periods fp ON fp.id = gab.fiscal_period_id AND fp.fiscal_year = p_fiscal_year
        WHERE ga.account_type IN ('revenue', 'expense') AND ga.is_active = true AND ga.is_header = false
        GROUP BY ga.id, ga.account_code, ga.account_name, ga.account_type, ga.normal_balance
        HAVING COALESCE(SUM(gab.debit_total), 0) != 0 OR COALESCE(SUM(gab.credit_total), 0) != 0
        ORDER BY ga.account_code
    LOOP
        -- Calculate the account's net balance for the year
        IF v_acct.normal_balance = 'debit' THEN
            v_acct_balance := v_acct.total_debits - v_acct.total_credits;  -- expense: positive = expense
        ELSE
            v_acct_balance := v_acct.total_credits - v_acct.total_debits;  -- revenue: positive = revenue
        END IF;

        IF v_acct_balance = 0 THEN CONTINUE; END IF;

        v_line_num := v_line_num + 1;

        -- Reverse the account balance: if revenue had CR balance, we DR it; if expense had DR balance, we CR it
        IF v_acct.normal_balance = 'credit' THEN
            -- Revenue account: DR to zero it out
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_acct.id, v_acct_balance, 0, 'Close ' || v_acct.account_name);
            v_net_balance := v_net_balance + v_acct_balance;  -- net profit contribution
        ELSE
            -- Expense account: CR to zero it out
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_acct.id, 0, v_acct_balance, 'Close ' || v_acct.account_name);
            v_net_balance := v_net_balance - v_acct_balance;  -- net profit reduction
        END IF;
    END LOOP;

    IF v_line_num = 0 THEN
        DELETE FROM gl_journal_entries WHERE id = v_entry_id;
        RETURN NULL;
    END IF;

    -- Retained Earnings line: CR if net profit, DR if net loss
    v_line_num := v_line_num + 1;
    IF v_net_balance > 0 THEN
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_retained_earnings_id, 0, v_net_balance, 'Net Income to Retained Earnings');
    ELSIF v_net_balance < 0 THEN
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_retained_earnings_id, ABS(v_net_balance), 0, 'Net Loss to Retained Earnings');
    END IF;

    -- Post the closing entry
    UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;

-- ============================================
-- FUNCTION: Carry Forward Opening Balances
-- Creates opening balance entries for new fiscal year from prior year BS accounts
-- ============================================
CREATE OR REPLACE FUNCTION public.gl_carry_forward_balances(p_from_year int, p_to_year int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_first_period_id UUID;
    v_first_period_start DATE;
    v_line_num INT := 0;
    v_acct RECORD;
    v_acct_balance NUMERIC;
    v_total_debit NUMERIC := 0;
    v_total_credit NUMERIC := 0;
BEGIN
    -- Ensure year-end close was done for from_year
    IF NOT EXISTS (SELECT 1 FROM gl_journal_entries WHERE source_module = 'year_end_close' AND source_id = p_from_year::text AND status = 'posted') THEN
        RAISE EXCEPTION 'Year-end close must be performed for FY% before carrying forward', p_from_year;
    END IF;

    -- Get first period of the target year
    SELECT id, start_date INTO v_first_period_id, v_first_period_start
    FROM gl_fiscal_periods
    WHERE fiscal_year = p_to_year
    ORDER BY period_number ASC LIMIT 1;

    IF v_first_period_id IS NULL THEN
        RAISE EXCEPTION 'No fiscal periods found for year %', p_to_year;
    END IF;

    -- Check if carry-forward already done
    IF EXISTS (SELECT 1 FROM gl_journal_entries WHERE source_module = 'opening_balance' AND source_id = p_to_year::text AND status = 'posted') THEN
        RAISE EXCEPTION 'Opening balances already created for FY%', p_to_year;
    END IF;

    v_entry_number := 'OB-' || p_to_year;

    INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
    VALUES (v_entry_number, v_first_period_start, 'Opening Balances FY' || p_to_year || ' (from FY' || p_from_year || ')', 'opening_balance', p_to_year::text, v_first_period_id, 'draft', auth.uid())
    RETURNING id INTO v_entry_id;

    -- Carry forward balance sheet accounts (asset, liability, equity) only
    FOR v_acct IN
        SELECT ga.id, ga.account_code, ga.account_name, ga.normal_balance,
               COALESCE(SUM(gab.debit_total), 0) AS total_debits,
               COALESCE(SUM(gab.credit_total), 0) AS total_credits
        FROM gl_accounts ga
        LEFT JOIN gl_account_balances gab ON gab.account_id = ga.id
        LEFT JOIN gl_fiscal_periods fp ON fp.id = gab.fiscal_period_id AND fp.fiscal_year = p_from_year
        WHERE ga.account_type IN ('asset', 'liability', 'equity') AND ga.is_active = true AND ga.is_header = false
        GROUP BY ga.id, ga.account_code, ga.account_name, ga.normal_balance
        HAVING COALESCE(SUM(gab.debit_total), 0) != 0 OR COALESCE(SUM(gab.credit_total), 0) != 0
        ORDER BY ga.account_code
    LOOP
        IF v_acct.normal_balance = 'debit' THEN
            v_acct_balance := v_acct.total_debits - v_acct.total_credits;
        ELSE
            v_acct_balance := v_acct.total_credits - v_acct.total_debits;
        END IF;

        IF v_acct_balance = 0 THEN CONTINUE; END IF;

        v_line_num := v_line_num + 1;

        IF v_acct.normal_balance = 'debit' THEN
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_acct.id, v_acct_balance, 0, 'Opening balance - ' || v_acct.account_name);
            v_total_debit := v_total_debit + v_acct_balance;
        ELSE
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_acct.id, 0, v_acct_balance, 'Opening balance - ' || v_acct.account_name);
            v_total_credit := v_total_credit + v_acct_balance;
        END IF;
    END LOOP;

    IF v_line_num = 0 THEN
        DELETE FROM gl_journal_entries WHERE id = v_entry_id;
        RETURN NULL;
    END IF;

    -- Post
    UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;

    RETURN v_entry_id;
END;
$$;

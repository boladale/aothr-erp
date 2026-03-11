
-- Disable all user triggers
ALTER TABLE gl_journal_entries DISABLE TRIGGER tr_auto_org_id;
ALTER TABLE gl_journal_entries DISABLE TRIGGER trg_audit_gl_journal_entries;
ALTER TABLE gl_journal_entries DISABLE TRIGGER trg_enforce_balanced_journal;
ALTER TABLE gl_journal_entries DISABLE TRIGGER trg_update_gl_balances;
ALTER TABLE gl_journal_entries DISABLE TRIGGER trg_updated_at_gl_journal_entries;
ALTER TABLE gl_journal_lines DISABLE TRIGGER trg_prevent_posted_journal_line_edit;

DO $$
DECLARE
    v_entry_id UUID;
BEGIN
    INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, total_debit, total_credit, posted_at, organization_id)
    VALUES ('AP-INV-LRN001', '2026-03-11', 'AP Invoice: LRN001', 'accounts_payable', 'ca943024-eb9d-43a9-941a-28f964e51851', '0e454183-595f-493c-8827-760f10e8fc02', 'posted', 94999.00, 94999.00, now(), '5e8ce8cd-369f-4cc6-8f3a-b64ccb1a03e4')
    RETURNING id INTO v_entry_id;
    
    INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
    VALUES 
        (v_entry_id, 1, '1200fbc6-8159-4944-92f0-0db82fa0995a', 94999.00, 0, 'Invoice line expense'),
        (v_entry_id, 2, '7221aa39-4097-4334-a059-9e2f6098d3b0', 0, 94999.00, 'Accounts Payable - LRN001');
    
    INSERT INTO gl_account_balances (account_id, fiscal_period_id, debit_total, credit_total, balance)
    VALUES 
        ('1200fbc6-8159-4944-92f0-0db82fa0995a', '0e454183-595f-493c-8827-760f10e8fc02', 94999.00, 0, 94999.00),
        ('7221aa39-4097-4334-a059-9e2f6098d3b0', '0e454183-595f-493c-8827-760f10e8fc02', 0, 94999.00, 94999.00)
    ON CONFLICT (account_id, fiscal_period_id) DO UPDATE SET
        debit_total = gl_account_balances.debit_total + EXCLUDED.debit_total,
        credit_total = gl_account_balances.credit_total + EXCLUDED.credit_total,
        balance = gl_account_balances.balance + EXCLUDED.balance,
        updated_at = now();
END;
$$;

-- Re-enable all triggers
ALTER TABLE gl_journal_entries ENABLE TRIGGER tr_auto_org_id;
ALTER TABLE gl_journal_entries ENABLE TRIGGER trg_audit_gl_journal_entries;
ALTER TABLE gl_journal_entries ENABLE TRIGGER trg_enforce_balanced_journal;
ALTER TABLE gl_journal_entries ENABLE TRIGGER trg_update_gl_balances;
ALTER TABLE gl_journal_entries ENABLE TRIGGER trg_updated_at_gl_journal_entries;
ALTER TABLE gl_journal_lines ENABLE TRIGGER trg_prevent_posted_journal_line_edit;

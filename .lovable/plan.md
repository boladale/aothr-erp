
# ERP Enhancement Plan

## Feature 1: Recurring Journal Entries
**Database:**
- `gl_recurring_entries` — template header: name, frequency (monthly/quarterly/yearly), next_run_date, gl_account mappings, active/inactive
- `gl_recurring_entry_lines` — template lines: account_id, debit, credit, description

**UI:**
- Recurring entries list page under Finance menu
- Create/edit recurring template form
- "Generate Now" button to manually trigger entry creation
- Auto-generation based on schedule (checked on page load or via cron-like logic)

---

## Feature 2: Period-End Closing
**Database:**
- `gl_closing_entries` — tracks year-end closing runs: fiscal_year, journal_entry_id, status
- Database function `run_period_close(fiscal_year)` that:
  1. Sums all Revenue & Expense account balances for the year
  2. Creates a closing journal entry (DR Revenue, CR Expense, net to Retained Earnings)
  3. Marks the fiscal year periods as "closed"

**UI:**
- "Close Period" button on the Fiscal Periods page
- Confirmation dialog showing P&L summary before closing
- Visual indicator for closed years

---

## Feature 3: Bank Statement Import
**Database:**
- No new tables needed — imports create `bank_transactions` records

**UI:**
- Import button on Bank Reconciliation page
- CSV upload with column mapping (date, description, amount, reference)
- Preview imported rows before confirming
- Support for common CSV formats (date, description, debit/credit or amount)

---

## Implementation Order
1. Recurring Journal Entries (schema + UI)
2. Period-End Closing (schema + function + UI)
3. Bank Statement Import (UI only, uses existing tables)

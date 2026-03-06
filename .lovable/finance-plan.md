# Finance ERP Module Plan

## Vision
Complete financial ERP (excluding HR) capable of producing P&L, Balance Sheet, and Trial Balance reports. All financial transactions flow through the General Ledger.

## Module Architecture

```
┌─────────────────────────────────────────────────┐
│                 GENERAL LEDGER                   │
│  Chart of Accounts │ Journal Entries │ Reports   │
├────────┬────────┬──────────┬──────────┬─────────┤
│   AP   │   AR   │ Inv Acct │ Cash Mgmt│ Project │
│ (exist)│  (new) │  (new)   │  (new)   │  (new)  │
└────────┴────────┴──────────┴──────────┴─────────┘
```

## Module 1: General Ledger (Foundation)

### Tables
- `gl_accounts` — Chart of accounts (asset, liability, equity, revenue, expense)
- `gl_journal_entries` — Header: entry_number, date, description, status, source_module
- `gl_journal_lines` — Lines: account_id, debit, credit, description
- `gl_fiscal_periods` — Period management: open/closed/locked

### Key Features
- Double-entry accounting enforcement (debits = credits per entry)
- Fiscal period controls (prevent posting to closed periods)
- Auto-posting from sub-ledgers (AP, AR, Inventory, Cash)
- Reports: Trial Balance, P&L (Income Statement), Balance Sheet

### Account Types & Normal Balances
| Type | Normal Balance | P&L / BS |
|------|---------------|----------|
| Asset | Debit | Balance Sheet |
| Liability | Credit | Balance Sheet |
| Equity | Credit | Balance Sheet |
| Revenue | Credit | P&L |
| Expense | Debit | P&L |

## Module 2: Accounts Payable (Enhancement)

### New Tables
- `ap_payments` — Payment records: payment_number, date, amount, method, bank_account
- `ap_payment_allocations` — Links payments to invoices

### Enhancements
- Payment tracking (paid/partial/unpaid status)
- AP aging report (current, 30, 60, 90+ days)
- Auto-post journal entries on invoice post & payment
- Vendor statement reconciliation

## Module 3: Accounts Receivable

### Tables
- `ar_customers` — Customer master data
- `ar_invoices` — Sales invoices
- `ar_invoice_lines` — Invoice line items
- `ar_receipts` — Customer payments received
- `ar_receipt_allocations` — Links receipts to invoices

### Key Features
- Customer invoicing
- Receipt processing
- AR aging report
- Auto-post to GL on invoice/receipt

## Module 4: Cash Management

### Tables
- `bank_accounts` — Company bank accounts
- `bank_transactions` — Individual transactions (deposits, withdrawals)
- `bank_reconciliations` — Reconciliation headers
- `bank_reconciliation_lines` — Matched transactions

### Key Features
- Bank account register
- Cash position dashboard
- Bank reconciliation workflow
- Auto-feed from AP payments & AR receipts

## Module 5: Inventory Accounting

### Enhancements (no new tables needed beyond existing)
- FIFO cost layers tracking via `inventory_cost_layers` table
- COGS calculation on goods issued
- Auto-post to GL: inventory receipts (DR Inventory, CR GR/IR), issues (DR COGS, CR Inventory)

### New Tables
- `inventory_cost_layers` — FIFO layers: item_id, location_id, quantity, unit_cost, remaining_qty, source (GRN)

## Module 6: Project Accounting (Cost Tracking)

### Tables
- `projects` — Project master: code, name, client, status, budget
- `project_cost_entries` — Cost allocations: project_id, cost_type, amount, source
- `project_budgets` — Budget lines per cost category

### Key Features
- Track material costs (from PO/GRN)
- Track labor hours (manual entry)
- Budget vs actual comparison
- Project profitability (costs only in Phase 1)

## GL Integration Map

| Event | Debit | Credit |
|-------|-------|--------|
| GRN Posted | Inventory | GR/IR Clearing |
| AP Invoice Posted | GR/IR Clearing + Expense | Accounts Payable |
| AP Payment | Accounts Payable | Bank/Cash |
| AR Invoice Posted | Accounts Receivable | Revenue |
| AR Receipt | Bank/Cash | Accounts Receivable |
| Inventory Issue | COGS | Inventory |
| Project Cost | Project Expense | various |

## Implementation Order
1. GL schema + Chart of Accounts UI + Journal Entries
2. GL Reports (Trial Balance, P&L, Balance Sheet)
3. AP payment tracking + GL posting
4. AR module
5. Cash Management
6. Inventory FIFO costing + GL posting
7. Project Accounting

## Costing Method: FIFO
- Each GRN creates a cost layer
- Issues consume oldest layers first
- COGS = actual cost of layers consumed

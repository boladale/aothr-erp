# Aothr AI Read Layer: Detailed Design (for approval, nothing built yet)

## Summary
There will be 15 read-only business summaries in their own protected area. Each summary is exposed as a secure read function that:
- checks that AI is switched on for the user's company,
- checks that the user has permission to see that area in the ERP,
- returns only that company's figures, plus the time the data was produced.

The AI can call only these functions. It cannot read or change any ERP table.

```text
ERP tables -> existing accounting logic (posted journals) -> ai.* read functions -> AI tools -> Ask Aothr -> user
```

## The 15 summaries: source, permission, and main columns

Every result includes `organization_id`, `as_of` (when the summary was produced) and `source_last_changed_at` (the most recent change in the source records). Every amount is in the company's base currency (₦).

| # | Summary | Built from | Who can see it (existing permission) | Main columns |
|---|---|---|---|---|
| 1 | business_health (checked first) | Calls 2, 3, 4, 5, 7, 8 and 12 | dashboard, plus each part is shown only if the user can see that area | revenue_ytd, net_profit_ytd, profit_vs_ly_pct, cash, receivables, overdue_receivables, payables, overdue_payables, stock_value, pending_approvals, alert_count, top_3_alerts. Parts the user can't see come back as null with a "restricted" flag |
| 2 | profit_loss_monthly | Posted journal lines + account types (same rules as Financial Reports) | financial_reports | month, revenue, cost_of_sales (51xx), gross_profit, gross_margin_pct, operating_expenses, net_profit; this year and last year |
| 3 | cash_position | Bank accounts + their ledger account balance from posted journals | bank_accounts / cash_dashboard | account, bank, type, ledger_balance, book_balance, difference, total_cash |
| 4 | receivables | Posted, unpaid customer invoices | ar_aging | total_owed, current, 1-30, 31-60, 61-90, 90+, top 10 owing customers |
| 5 | payables | Posted, unpaid supplier invoices | ap_aging | Same breakdown as receivables, with top 10 suppliers owed |
| 6 | sales_performance | Quotes, sales orders, customer invoices | sales_reports | month, quotes, orders, invoiced, conversion_pct, avg_order |
| 7 | inventory_position | Stock balances, costing layers, items | inventory_valuation | value_by_warehouse, below_reorder list, slow_moving_90d, expiring_30d |
| 8 | procurement_position | Purchase orders, requisitions, RFQs | procurement_dashboard | POs by status (count and value), overdue deliveries, approvals older than 7 days, open RFQs |
| 9 | supplier_performance | Purchase orders, goods receipts, supplier invoices and payments | vendor_performance | supplier, spend_ytd, on_time_pct, outstanding, blacklist_status |
| 10 | payroll_position | Payroll runs (totals only) | payroll_runs | month, headcount, gross, deductions, net, tax, pension. Individual pay is not included |
| 11 | project_position | Projects, project costs, project revenue | project_profitability | project, status, budget, actual_cost, revenue, margin_pct, over_budget flag |
| 12 | business_alerts | Rules applied to summaries 3-11 | Only the alerts from areas the user can see | type, severity, message, amount, link_to_page |
| 13 | customer_intelligence | Customers + customer invoices, receipts, sales orders | customers + sales_reports | total, active_90d, new_this_month, inactive, sales_ytd, balance, overdue, 3-month trend (rising/falling), margin where projects link. Only name and code, no contact details |
| 14 | expense_analysis | Posted journal lines, expense accounts, budget lines | financial_reports | category (account), month, amount, change_pct vs previous month, budget, variance, unusual flag (more than 50% above the 3-month average) |
| 15 | tax_position | Tax account 2300 balance from posted journals, tax on sales and purchase invoices, tax rates | tax_configuration | tax_collected, tax_paid_on_purchases, net_liability, rates in use, by_period. Filing status is shown as unavailable |

## Reusing existing ERP logic
- Financial figures in 1, 2, 3, 14 and 15 use exactly the same rules as the Financial Reports page (posted journals only, debit/credit sign set by account type). I'll move those rules into one shared database function, `ai.account_balances(from, to)`, so the AI and the reports can't disagree.
- Aging, inventory valuation and project margin follow the calculations the ERP already uses.

## Individual pay and personal details
- The general AI context never includes individual salaries or personal staff details.
- A separate HR function, `ai.payroll_employee_detail`, will exist only for users with the payroll_runs or employees permission. It is not included in Phase 1's tool list unless you want it.

## Company AI switch (enforced on the server)
- A new settings table, `ai_settings` (one row per company), with switches for: ai_enabled, chat, insights, alerts, automation, actions, and morning_brief. It also stores the AI model/provider name, so the provider can be changed later without rebuilding.
- Every AI read function and the AI service refuse to run when the relevant switch is off.
- Only admins can change the switches. Phase 1 shows the main on/off switch in Admin.

## Security approach
- A separate `ai` schema. Every function is read-only and runs its checks first: company = the user's company, the permission in the table above, and ai_enabled = true.
- No function in the `ai` schema can write. They are declared read-only, so any write attempt fails.
- The AI service calls these functions using the signed-in user's own login, never an all-access key. That means the AI can never see more than that user can see in the ERP.
- Future actions go: AI suggests -> a draft action is prepared -> a person approves -> the existing secure-action function carries it out. The AI never writes directly.

## Tools that use each summary (Phase 1 core tools)
- get_business_health -> 1
- get_financials -> 2, 14
- get_cash -> 3
- get_receivables / get_payables -> 4 / 5
- get_sales / get_customers -> 6 / 13
- get_inventory -> 7
- get_procurement / get_suppliers -> 8 / 9
- get_payroll_summary -> 10
- get_projects -> 11
- get_alerts -> 12
- get_tax -> 15

For broad questions the AI checks business health first. It then fetches the detailed summaries it needs (for example, for "why is cash low?": 3, then 4, 5 and 8).

## How fresh the data is
- Everything is computed live when the AI asks, so it is current to the moment of the question. `as_of` is shown to the user, for example: "Figures as of 10:42."
- No copied or stored datasets in Phase 1.

## Speed
- Add indexes where they are missing (journal entries by company, status and date; invoices by company, payment status and due date).
- Each summary returns a small result (usually under 50 rows). Lists are capped at the top 10, which keeps AI usage low.
- Pre-stored snapshots will be added only if a summary takes longer than about 1.5 seconds on real data.

## Data gaps found
- Tax: no filing status or return periods are stored, so these are reported as unavailable.
- Customer profitability: only available where sales link to projects.
- Supplier on-time rate: needs the PO expected date. Where it's missing, the result is marked "not measured".
- Chairman/MD sees everything through the executive/admin role.

## Build order after approval
1. The settings table and switches.
2. The shared account balances function.
3. The 15 read functions, with checks.
4. Test each one against Learnsoft IT's data and compare it with Financial Reports.
5. Then the AI tools and the agent (a separate step for your approval).

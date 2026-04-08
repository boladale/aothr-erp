## 1. Advanced Dashboards with Drill-Down
- Add trend charts (recharts) to Finance, Procurement, and Cash dashboards
- CFO-level KPIs: revenue vs expenses, cash burn rate, AP/AR aging summary
- Clickable metric cards that navigate to filtered list views
- Mini sparkline charts on metric cards

## 2. Automated Period-End Closing
- Add a "Run Period-End Close" button on Fiscal Periods page
- Calls existing `gl_period_end_summary` and `gl_year_end_close` DB functions
- Auto-carry-forward balances via `gl_carry_forward_balances`
- Show closing checklist (open entries, unreconciled items) before allowing close
- Add auto-reversal support for accrual entries

## 3. Bulk Operations
- Bulk approve/reject on Requisitions, POs, and Journal Entries list pages
- Bulk post journal entries
- Select-all / multi-select checkboxes in DataTable component
- Bulk status change with confirmation dialog

# AOTHR ERP — Read-only capability audit (vs Innov8 Technology Hub RFP)

Inspection only. No files, settings, data or deployments changed. **No runtime tests were run for this audit.** Classifications come from code evidence (routes, pages, database tables/functions, server functions). Where this conversation earlier ran live checks (e.g. Ask Aothr answers, cash position), that is marked "previously exercised".

## Summary
- 123 routes in `src/App.tsx` (lines 212–340), 124 page files in `src/pages/`, 150+ database tables, 185 migrations in `supabase/migrations/`, 22 server functions in `supabase/functions/`.
- Strong, connected coverage: Finance & Accounting, Procurement (full requisition → payment chain), Inventory & Warehouse, Sales, basic HR, Payroll, Projects (costing), Fixed Assets, Budgets, Executive Intelligence (My Briefing / Ask Aothr), staff and vendor portals, admin/security.
- Absent: Manufacturing (MRP/BOM/routings/work orders), recruitment, onboarding, performance, learning, engineering/QA, agile software delivery, programme/cohort management, EcoLab waste processing, creative media studio, facilities/fleet.
- Testing is thin: `src/test/example.test.ts` is a placeholder (`expect(true)`); `src/test/cash_position_regression.py` is the only real regression check.

## 1. Navigation / routes (src/App.tsx)
| Area | Routes → component (src/pages/*) |
|---|---|
| Intelligence | `/` MyBriefing, `/ask-aothr` AskAothr, `/demo` DemoLogin |
| Dashboards | `/dashboard`, `/executive-dashboard`, `/chairman-dashboard(+/list/:type, /vendor/:id)`, `/procurement-`, `/warehouse-`, `/finance-`, `/sales-`, `/cash-dashboard`, `/vendor-dashboard` |
| Procurement | `/requisitions(/:id)`, `/rfps(/:id)` (shown as RFQ), `/purchase-orders(/:id)`, `/goods-receipts`, `/invoices`, `/invoice-inbox`, `/match-exceptions`, `/po-closure`, `/vendors`, `/vendor-registrations`, `/vendor-performance`, `/vendor-statement`, `/vendor-payment-report`, `/req-to-payment-report`, `/procurement-kpi`, `/procurement-audit`, `/procurement-reports`, `/goods-delivered` |
| Inventory | `/items`, `/locations`, `/inventory`, `/inventory-issues`, `/inventory-transfers`, `/stock-movements`, `/inventory-valuation`, `/inventory-reports`, `/warehouse-reports` |
| Finance | `/chart-of-accounts`, `/journal-entries`, `/recurring-entries`, `/fiscal-periods`, `/financial-reports`, `/account-statement`, `/ap-payments`, `/ap-aging`, `/ap-credit-notes`, `/ap-reports`, `/customers`, `/ar-invoices`, `/ar-receipts`, `/ar-credit-notes`, `/ar-aging`, `/ar-reports`, `/bank-accounts`, `/bank-reconciliation`, `/bank-statement`, `/fund-transfers`, `/cash-flow-forecast`, `/cash-reports`, `/budgets(/:id)`, `/budget-reports`, `/tax-configuration`, `/compliance-reports`, `/opening-balances`, `/fixed-assets` |
| Sales | `/services`, `/sales-quotations`, `/sales-orders`, `/delivery-notes` |
| Projects | `/projects(/:id)`, `/project-profitability` |
| HR / Payroll | `/departments`, `/job-roles`, `/employees(/:id)`, `/leave-management`, `/attendance`, `/salary-components`, `/pay-grades`, `/payroll-runs(/:id)`, `/payslips` |
| Portals | `/self-service/*`, `/staff-portal/*` (StaffPortalGuard), `/vendor-portal(/login)` (VendorPortalGuard) |
| Admin | `/admin`, `/user-management`, `/approval-rules`, `/workflows`, `/notifications`, `/audit-report`, `/system-health`, `/email-monitor`, `/email-events`, `/org-setup`, `/profile` |
| Guides | `/user-guide`, `/creator-handbook`, `/flow-diagrams`, `/trainers-script` (content pages) |

## 2. Domain classification matrix
Legend: **A** = UI + backend + business logic; **B** = UI, backend logic incomplete; **C** = limited/placeholder; **D** = absent. Confidence: H/M/L (code-based).

| Domain | Class | Evidence | Conf. |
|---|---|---|---|
| General ledger, CoA, journals, periods, year-end | A | Tables `gl_accounts`, `gl_journal_entries/lines`, `gl_fiscal_periods`; triggers `enforce_balanced_journal_entry`, `enforce_fiscal_period_lock`; functions `gl_year_end_close`, `gl_carry_forward_balances`, `generate_recurring_entry` | H |
| AP (invoices, credit notes, payments, aging) | A | `ap_invoices/lines`, `ap_payments`, `ap_payment_allocations`, `ap_credit_notes`; triggers `gl_post_ap_invoice`, `gl_post_ap_payment`, `enforce_no_over_invoice`, `check_invoice_holds_before_post` | H |
| AR (invoices, receipts, credit notes) | A | `ar_*` tables; `gl_post_ar_invoice/receipt/credit_note` | H |
| Bank, reconciliation, fund transfers, petty cash | A | `bank_accounts`, `bank_transactions`, `bank_reconciliations`, `fund_transfers`; `gl_post_fund_transfer`; AI matching server function `ai-reconcile` | H (cash position previously exercised) |
| Budgets / commitments | A | `budgets`, `budget_lines`, `budget_consumption`, `budget_transactions` | M |
| Tax (VAT) | A | `tax_groups`, `tax_rates`, `item_tax_mappings`; TaxConfiguration page. Statutory filing not present | M |
| Multi-currency | B | `currencies`, `exchange_rates` exist; extent of revaluation logic not confirmed | L |
| Procurement chain | A | See section 3 | H |
| Vendor onboarding / portal | A | `vendor_registration_requests`, `vendor_invite_tokens`, `vendor_users`, `vendor_po_acknowledgments`; functions `vendor-accept-invite`, `consume_vendor_invite_token` | M |
| Inventory & warehouse | A | `inventory_balances`, `inventory_costing_layers/consumptions` (FIFO via `consume_fifo_layers`), issues/returns, transfers (`enforce_transfer_stock_availability`), adjustments, reservations, `reorder_rules` | H |
| Sales (quote → order → delivery → invoice) | A | `sales_quotations`, `sales_orders`, `delivery_notes`; trigger `consume_so_reservation_on_dn` | M |
| HR core (employees, departments, job roles, leave, attendance) | A / B | `employees` (32 cols), `leave_requests`, `leave_balances`, `leave_types`, `attendance_records`. Attendance page has only 3 queries — likely manual entry, no device/clock-in integration | M |
| Expense claims (self-service) | A | `expense_claims/lines`, SelfServiceExpenses | M |
| Payroll | A | `payroll_runs`, `payroll_lines`, `payslips`, `salary_components`, `pay_grades`, `generate_employee_salary_from_grade`; GL posting per memory rule. Nigerian PAYE/pension rule depth not verified | M |
| Projects | B | `projects`, `project_costs`, `project_revenues`, `gl_post_project_cost`. No tasks, milestones, timesheets or resourcing. Project revenue not posted to the main P&L (seen in demo data) | M |
| Fixed assets | A | `fixed_assets`, `fixed_asset_categories`, `fixed_asset_depreciation`, `dispose_fixed_asset`. No maintenance/work orders | M |
| Approvals / workflow engine | A | `approval_rules/instances/steps/actions`, `workflows`, `workflow_states/transitions`; authenticator code on approvals (`src/components/auth/ApprovalCodeDialog`) | M (MFA not phone-tested) |
| E-signatures | A | `signature_requests`; `boldsign-send/status/webhook/download` | L (download untested) |
| Executive intelligence (AOTHR) | A | `ask-aothr`, `briefing-summary` server functions; ~30 `ai_*` read functions; `ai_settings`, `ai_provider_keys`, `ai_conversations/messages`, `ai_demo_questions` | H (answers previously exercised) |
| Admin, RBAC, audit, backup, email | A | `roles`, `role_permissions`, `user_roles`, `has_permission`; `audit_logs` + audit triggers; `admin-backup`, `data_backups`; email queue functions | M |
| Manufacturing | D | No BOM, routing, work-order or MRP tables or pages. Only "Manufacturing" hit is a vendor category label in `VendorPortalLogin.tsx` | H |

## 3. Cross-module workflows (code evidence)
| Workflow | End-to-end? | Evidence |
|---|---|---|
| Requisition → approval → RFQ/bids → PO → GRN → 3-way match → AP payment | Yes | `requisitions` + `enforce_requisition_lock`; `rfps`, `rfp_proposals`, `requisition_bid_*`, `bid_invitations`; `po_line_requisition_lines`; `purchase_orders` + `enforce_po_lock`, `po_approvals`, `po_payment_milestones`; `goods_receipts` + `gl_post_grn_and_create_layers`, `enforce_no_over_receipt`; `match_runs/lines`, `invoice_holds`; `ap_payments` + `gl_post_ap_payment`; report `RequisitionToPaymentReport.tsx` |
| Inventory issues / returns / transfers | Yes | `gl_post_inventory_issue`, `gl_post_inventory_issue_return`, `inventory_transfers` + stock guard |
| GL postings and bank reconciliation | Yes | Posting triggers above; `bank_reconciliations`, `ai-reconcile` |
| Leave / attendance / payroll | Partly | Leave and payroll linked to employees; no evidence attendance feeds payroll calculation |
| Project costs / revenues | Partly | Costs post to GL; revenues recorded per project but not posted to GL |

Runtime: none of these chains were executed in this audit.

## 4. Innov8-specific gaps (all absent unless noted)
| Requirement | Status | Note |
|---|---|---|
| Recruitment / applicant tracking | D | No applicant/vacancy tables |
| Onboarding | D | Only user/vendor onboarding, not employee checklists |
| Performance / appraisal | D | — |
| Learning / training | D | `TrainersScript.tsx` is a guide for teaching the ERP, not an LMS |
| MRP / BOM / routings / work orders / scheduling | D | — |
| Engineering / prototyping / drawings / QA | D | Attachments exist generically (`transaction_attachments`) only |
| Agile: sprints, backlog, bugs, GitHub/GitLab | D | Single "Sprint" text match in a 2026-02-07 migration is incidental |
| Programmes: applications, cohorts, participants, assessments, M&E, IP, alumni, certificates | D | — |
| EcoLab: waste classification, collection, recovery, yield, environmental impact; ceramics/leather/garment routing | D | Could reuse items/locations/issues as a base only |
| Creative media: studio booking, crew, media assets, review | D | — |
| Facilities: room booking, incidents, maintenance, fleet | D | Fixed assets register exists; no maintenance or booking |

## 5. Confidence and method
- **Code evidence:** route list, page files, table/function catalogue, server function folder names.
- **Not verified in this audit:** whether each page's buttons fully work, report accuracy, payroll tax correctness, multi-currency revaluation, attendance→payroll link, MFA sign-in with a real phone, signed-PDF download.
- **Previously exercised in this project (earlier turns, not this audit):** Ask Aothr answers on demo data, cash/ledger reconciliation, chat history saving, demo login.

## 6. Security / data-integrity concerns (not fixed)
1. Almost no automated tests (placeholder test + one Python check) — regressions in posting logic would go unnoticed.
2. Pages query the database directly (43 component files plus most pages; only 6 shared hooks) and project memory documents `as any` casts around generated types — weakens type safety.
3. Demo account (`demo@aothr.com`) has the executive role on Learnsoft IT, which can read individual payroll; Learnsoft IT also contains some real test records mixed with "DEMO-" data.
4. Earlier security review left ~72 warnings judged acceptable (public currency list, public logos, invite link) — need a fresh scan before any tender submission.
5. Authenticator (MFA) and 90-day password expiry are built but not tested end-to-end.
6. Project revenue is outside the GL, so project profitability and company P&L can disagree.
7. Single shared backend instance serves preview and live site — testing in preview touches live data.

## Suggested next step (if you approve)
No build work is proposed. Optional follow-ups: run a fresh security scan, run selected workflows in the browser to upgrade "code evidence" to "tested", and scope the Innov8 gap modules (HR talent, manufacturing, programmes, EcoLab, facilities) as separate phases.


# Phase 2 Extension Plan: Finance-Grade Controls and Automation

## Status: Sprint 1 In Progress ✅

### Completed
- [x] All Phase 2 database tables created
- [x] Enums for match status, approval types, hold types, budget status, reservation status
- [x] Three-way matching engine (`run_three_way_match` function)
- [x] Invoice hold enforcement trigger
- [x] Automatic three-way match on invoice post attempt
- [x] Reservation validation trigger
- [x] RLS policies for all new tables
- [x] Audit triggers for Phase 2 tables
- [x] Match Exceptions UI (`/match-exceptions`)

### In Progress
- [ ] Update plan.md with remaining Sprint 1 items

## Overview

This plan extends the Phase 1 MVP procurement system with advanced financial controls, automation, and analytics while preserving all existing Phase 1 correctness guarantees.

## Scope Summary

| In Scope | Out of Scope |
|----------|--------------|
| Three-way matching (PO-GRN-Invoice) | Payments & disbursements |
| Rule-based approval workflows | GL posting & journal entries |
| AP automation with invoice holds | OCR/document scanning |
| Budget management & commitments | Multi-currency support |
| Inventory reservations | Tax calculation engines |
| Advanced analytics dashboards | External accounting integrations |

---

## Phase 2A: Database Schema Extensions

### 1. Three-Way Matching Tables

```text
+------------------+       +------------------+
|   match_runs     |------>|   match_lines    |
+------------------+       +------------------+
| id               |       | id               |
| invoice_id (FK)  |       | match_run_id     |
| run_date         |       | po_line_id       |
| match_status     |       | grn_line_id      |
| tolerance_pct    |       | invoice_line_id  |
| total_exceptions |       | qty_po           |
| created_by       |       | qty_grn          |
| created_at       |       | qty_invoice      |
+------------------+       | price_po         |
                           | price_invoice    |
                           | variance_amt     |
                           | match_status     |
                           +------------------+
```

- `match_status` enum: `matched`, `qty_exception`, `price_exception`, `missing_grn`, `missing_invoice`
- Runs automatically on invoice post via database trigger
- Configurable tolerance percentage (default 0% for quantity, configurable for price)

### 2. Approval Engine Tables

```text
+------------------+       +------------------+       +------------------+
|  approval_rules  |------>| approval_steps   |------>|approval_instances|
+------------------+       +------------------+       +------------------+
| id               |       | id               |       | id               |
| entity_type      |       | rule_id          |       | rule_id          |
| rule_name        |       | step_order       |       | entity_type      |
| conditions (JSON)|       | step_type        |       | entity_id        |
| is_active        |       | approver_role    |       | current_step     |
| priority         |       | approver_user_id |       | status           |
+------------------+       | delegation_user  |       | submitted_at     |
                           | timeout_hours    |       | completed_at     |
                           +------------------+       +------------------+
                                                              |
                                                              v
                                                      +------------------+
                                                      | approval_actions |
                                                      +------------------+
                                                      | id               |
                                                      | instance_id      |
                                                      | step_id          |
                                                      | actor_id         |
                                                      | action           |
                                                      | comments         |
                                                      | acted_at         |
                                                      +------------------+
```

- `step_type` enum: `sequential`, `parallel`, `any_of`
- `action` enum: `approved`, `rejected`, `delegated`, `escalated`
- Conditions stored as JSON for flexible threshold rules (e.g., `{"total_amount": {"gt": 10000}}`)
- Support for role-based or user-specific approvers with delegation

### 3. AP Automation Tables

```text
+------------------+       +------------------+
|  invoice_holds   |       |invoice_approvals |
+------------------+       +------------------+
| id               |       | id               |
| invoice_id (FK)  |       | invoice_id       |
| hold_type        |       | approval_inst_id |
| hold_reason      |       | status           |
| created_at       |       | approved_by      |
| resolved_at      |       | approved_at      |
| resolved_by      |       | comments         |
| resolution_notes |       +------------------+
+------------------+
```

- `hold_type` enum: `match_exception`, `approval_pending`, `budget_exceeded`, `manual`
- Invoices with unresolved holds cannot be posted
- Links invoice to approval_instances for threshold-based approvals

### 4. Budgeting Tables

```text
+------------------+       +------------------+       +------------------+
|     budgets      |------>|   budget_lines   |<------|budget_consumption|
+------------------+       +------------------+       +------------------+
| id               |       | id               |       | id               |
| budget_code      |       | budget_id        |       | budget_line_id   |
| name             |       | category         |       | source_type      |
| fiscal_year      |       | budgeted_amount  |       | source_id        |
| status           |       | committed_amount |       | amount           |
| start_date       |       | consumed_amount  |       | transaction_type |
| end_date         |       | available_amount |       | transaction_date |
| created_by       |       +------------------+       | posted           |
+------------------+                                  +------------------+
```

- `budget.status` enum: `draft`, `active`, `closed`, `frozen`
- `source_type`: `po_commitment`, `invoice_actual`
- `transaction_type`: `commit`, `uncommit`, `consume`, `reverse`
- Commitments created at PO approval, converted to actuals at invoice post

### 5. Inventory Extensions

```text
+------------------+       +------------------------+
|   reorder_rules  |       | inventory_reservations |
+------------------+       +------------------------+
| id               |       | id                     |
| item_id (FK)     |       | item_id                |
| location_id      |       | location_id            |
| reorder_point    |       | po_line_id             |
| reorder_qty      |       | reserved_qty           |
| lead_time_days   |       | status                 |
| is_active        |       | expires_at             |
| last_checked_at  |       | created_at             |
+------------------+       +------------------------+
```

- Reservations reduce available quantity without changing balance
- `status` enum: `active`, `fulfilled`, `cancelled`, `expired`
- Soft reservations auto-expire; hard reservations require manual release

---

## Phase 2B: Business Logic & Triggers

### 1. Three-Way Matching Engine

**Trigger: `run_three_way_match`** (fires on invoice status change to 'posted')

```text
FOR EACH invoice line:
  1. Find matching PO line
  2. Find posted GRN lines for that PO line
  3. Compare: qty_invoice <= qty_grn <= qty_po
  4. Compare: price_invoice within tolerance of price_po
  5. Record match_line with status
  
IF any exceptions:
  - Create invoice_hold with type 'match_exception'
  - Block invoice post (invoice stays in 'draft')
  - Notify accounts_payable role
ELSE:
  - Allow invoice post
  - Mark match_run as 'matched'
```

### 2. Approval Workflow Engine

**Function: `initiate_approval`**

```text
1. Find matching approval_rules by entity_type and conditions
2. Select highest priority rule where conditions match
3. Create approval_instance
4. Create first step(s) based on step_type
5. Notify assigned approvers
```

**Function: `process_approval_action`**

```text
1. Record approval_action
2. IF action = 'approved':
   - Mark step complete
   - IF parallel: check all steps complete
   - IF sequential: activate next step
   - IF all steps done: mark instance 'approved', update entity
3. IF action = 'rejected':
   - Mark instance 'rejected'
   - Update entity status
4. IF action = 'delegated':
   - Update step with new approver
   - Notify delegate
```

### 3. Budget Commitment Engine

**Trigger: `create_po_commitment`** (fires on PO status change to 'approved')

```text
FOR EACH PO line:
  1. Find budget_line by item category + fiscal period
  2. Check: committed + line_total <= budgeted
  3. IF over budget:
     - Block approval OR create warning (based on config)
  4. Create budget_consumption record (type: 'commit')
  5. Update budget_line.committed_amount
```

**Trigger: `convert_commitment_to_actual`** (fires on invoice post)

```text
FOR EACH invoice line:
  1. Find corresponding commitment
  2. Reverse commitment (type: 'uncommit')
  3. Create actual consumption (type: 'consume')
  4. Update budget_line totals
```

### 4. Inventory Reservation Logic

**Function: `create_reservation`**

```text
1. Calculate available = balance.quantity - SUM(active reservations)
2. IF reserved_qty > available: RAISE EXCEPTION
3. Create inventory_reservation record
4. Return reservation_id
```

**Trigger: `fulfill_reservation_on_grn`** (fires on GRN post)

```text
FOR EACH GRN line:
  1. Find active reservations for item/location
  2. Fulfill oldest reservations first (FIFO)
  3. Mark reservation as 'fulfilled'
  4. Update inventory balance (normal GRN flow)
```

---

## Phase 2C: RLS & Security Policies

All new tables will follow Phase 1 RBAC patterns:

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|---------------------|
| match_runs | All auth users | accounts_payable, admin |
| approval_rules | All auth users | admin only |
| approval_instances | Own + role-based | System triggers |
| invoice_holds | All auth users | accounts_payable, admin |
| budgets | All auth users | admin, procurement_manager |
| inventory_reservations | All auth users | warehouse_manager, admin |

---

## Phase 2D: New UI Screens

### 1. Match Exceptions Dashboard (`/match-exceptions`)
- List of invoices with matching exceptions
- Drill-down to line-level discrepancies
- Resolution workflow (override, adjust, void)
- Filter by exception type, vendor, date range

### 2. Approval Workbench (`/approvals`)
- Pending approvals for current user
- Approval history
- Delegation management
- Bulk approve/reject capability

### 3. Budget Management (`/budgets`)
- Budget creation and line setup
- Real-time commitment vs actual tracking
- Variance analysis
- Budget-to-PO linkage view

### 4. Inventory Reservations (`/inventory/reservations`)
- Active reservations list
- Manual reservation creation
- Release/cancel functionality
- Expiration warnings

### 5. Analytics Dashboard (`/analytics`)
- Procurement spend trends
- Vendor performance metrics
- Budget utilization charts
- Matching accuracy rates

---

## Phase 2E: API Endpoints (Edge Functions)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/match-run` | POST | Trigger manual match run |
| `/match-exception/resolve` | POST | Resolve exception with override |
| `/approval/submit` | POST | Submit entity for approval |
| `/approval/action` | POST | Record approve/reject/delegate |
| `/budget/check` | GET | Check budget availability |
| `/reservation/create` | POST | Create inventory reservation |
| `/reservation/release` | POST | Release reservation |

---

## Implementation Phases

### Sprint 1: Foundation (Weeks 1-2)
1. Database migration with all Phase 2 tables
2. Core triggers for three-way matching
3. Basic match exceptions UI
4. RLS policies for new tables

### Sprint 2: Approvals (Weeks 3-4)
1. Approval engine tables and functions
2. Rule configuration UI
3. Approval workbench
4. Integration with PO and Invoice workflows

### Sprint 3: Budgeting (Weeks 5-6)
1. Budget tables and commitment logic
2. Budget management UI
3. PO approval integration with budget check
4. Invoice consumption tracking

### Sprint 4: Inventory & Analytics (Weeks 7-8)
1. Reservation system
2. Reorder rules (monitoring only, no auto-PO)
3. Analytics dashboard
4. Performance optimization

---

## Technical Considerations

### Database Invariants (Server-Side Enforcement)

1. **Match exceptions block posting**: Trigger prevents invoice status change if unresolved holds exist
2. **Approval required**: Trigger checks approval_instance status before entity state change
3. **Budget enforcement**: Trigger validates budget availability before PO approval
4. **Reservation limits**: Function ensures reserved + requested <= available balance
5. **Concurrency**: All critical operations use `SELECT FOR UPDATE` for row locking

### Migration Strategy

- All migrations are additive (no breaking changes to Phase 1)
- New tables reference existing Phase 1 tables via foreign keys
- Existing workflows continue to work during rollout
- Feature flags can be used to gradually enable Phase 2 features

### Audit Trail

All Phase 2 actions will be logged to the existing `audit_logs` table with new entity types:
- `match_runs`, `match_lines`
- `approval_rules`, `approval_instances`, `approval_actions`
- `invoice_holds`
- `budgets`, `budget_lines`, `budget_consumption`
- `inventory_reservations`

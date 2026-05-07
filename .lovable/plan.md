# Warehouse / Procurement enhancements

## 1. GRN — weigh-bill & partial deliveries

Current state (verified):
- Weigh-bill number is already mandatory in `GoodsReceipts.tsx` (frontend validation) and stored on `goods_receipts.weigh_bill_number`.
- Multiple GRNs per PO are already supported. Each GRN line is clamped to `qty_ordered - qty_received_so_far`, so a short delivery automatically becomes a "temporary" GRN and a new GRN can be raised later for the balance.

What we will add:
- Make `weigh_bill_number` **NOT NULL** at the database level (currently only enforced in the UI).
- Add a derived `delivery_status` shown on the GRN list and PO detail: **Partial** when `Σ qty_received < qty_ordered` for the PO, **Complete** when fully received. (No new column required — computed from existing `purchase_order_lines.qty_received` vs `quantity`.)
- On the PO detail "Lines" table, add a **Balance to Deliver** column = `quantity - qty_received` so the outstanding balance after a partial GRN is obvious.

## 2. Inventory transfer with dual-location approval

Currently the `InventoryTransfers` page writes to `inventory_transfers` / `inventory_transfer_lines`, but **those tables don't exist in the database** (the page is broken). We will create them with a proper two-side approval workflow.

Workflow:

```text
draft
  └─(submit)──▶ pending_source_approval     (source warehouse manager approves goods leaving)
                  └─(approve)──▶ in_transit (stock deducted from source)
                                   └─(receive + approve at destination)──▶ received (stock added at destination)
reject at any approval step ──▶ rejected (no stock movement)
```

Tables (new):
- `inventory_transfers` — header, with `from_location_id`, `to_location_id`, `status`, `source_approved_by/at`, `destination_approved_by/at`, `rejection_reason`, `organization_id`, audit columns.
- `inventory_transfer_lines` — `transfer_id`, `item_id`, `quantity`, `line_number`.

Backend rules (DB triggers, SECURITY DEFINER):
- Block negative source balance when moving to `in_transit`.
- On `in_transit`: decrement source `inventory_balances` and consume FIFO layers.
- On `received`: increment destination `inventory_balances` and create a new FIFO layer at the same unit cost.
- Audit log entries on each state change.
- RLS: only org members can read; only users with `warehouse_manager` / `admin` roles at the relevant location can approve.

UI changes in `InventoryTransfers.tsx`:
- Replace the single "Post" button with: **Submit**, **Approve at Source**, **Approve at Destination**, **Reject**, gated by status and role.
- Show both approval signatures and timestamps in the row detail.

## 3. Warehouse staff can close PO

- Update `PurchaseOrderDetail.tsx` so the **Close PO** button is shown to users with `warehouse_manager` or `warehouse_staff` roles (in addition to admin/procurement_manager) when `close_ready = true`.
- Update RLS / row-level update policy on `purchase_orders` so those roles can flip status to `closed` (and only that transition).

## 4. Procurement notifications

Add SECURITY DEFINER triggers that fan out notifications to every user with `procurement_officer` or `procurement_manager` role in the same organization:

| Event | Trigger source | Notification type |
|---|---|---|
| Goods delivered | `goods_receipts` row goes `draft → posted` | `grn_posted` |
| PO closed | `purchase_orders` row goes `… → closed` | `po_closed` |
| PO paid | `ap_payments` row goes `draft → posted` (linked to a PO via its invoice) | `po_paid` |

Each notification carries the PO/GRN number in `title` and a human-readable `message`, deduped by the existing `(user_id, entity_type, entity_id, notification_type)` unique constraint. They surface automatically in the existing notification bell.

## Technical notes

- Migration order: create `inventory_transfers` tables → add NOT NULL constraint to `weigh_bill_number` (after backfilling any historical NULLs with `'LEGACY'`) → add the three notification triggers → add the warehouse close-PO policy.
- All inserts from the client will continue to set `organization_id` explicitly per multi-tenant rules.
- No edge functions required.
- No changes to existing GL posting logic.

## Files touched

- New migration: tables, triggers, RLS, NOT NULL constraint, notification fan-out functions.
- `src/pages/InventoryTransfers.tsx` — replace single-step posting with dual-approval flow.
- `src/pages/PurchaseOrderDetail.tsx` — add Balance column, broaden close-PO visibility.
- `src/pages/GoodsReceipts.tsx` — show Partial/Complete badge in list.

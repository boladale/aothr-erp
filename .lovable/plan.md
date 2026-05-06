## Vendor PO Rejection & Re-Award Flow

When the awarded vendor rejects a PO, the system will: require a reason, notify procurement, auto-cancel the PO, and start an approval-gated re-award to the next-best (runner-up) bidder using their original quoted price and payment terms.

### 1. Mandatory Rejection Reason
- **UI** (`VendorPOAcceptance.tsx`): require non-empty `notes` when action is `rejected`; show inline error; disable submit button until filled (min 10 chars).
- **DB** (`vendor_po_acknowledgments`): add CHECK — `action <> 'rejected' OR (notes IS NOT NULL AND length(trim(notes)) >= 10)`.

### 2. Auto-Cancel PO + Notify Procurement
A new SECURITY DEFINER trigger on `vendor_po_acknowledgments` AFTER INSERT, when `action = 'rejected'`:
- Updates `purchase_orders.status = 'cancelled'`, sets `acceptance_status = 'vendor_rejected'`, stores `vendor_rejection_reason`.
- Releases budget commitment tied to the PO (existing commitment release helper).
- Inserts `notifications` rows for all users in the org with role `procurement_manager` or `procurement_officer` (and admins) — title: "Vendor rejected PO {po_number}", linking to the PO detail.
- If the PO came from an RFP (`purchase_orders.rfp_id`), creates a `po_reaward_requests` row in `pending_approval` state pre-populated with the runner-up proposal.

### 3. Runner-Up Re-Award Approval
**New table `po_reaward_requests`**:
- `original_po_id`, `rfp_id`, `runner_up_proposal_id`, `runner_up_vendor_id`
- `proposed_total`, `proposed_payment_terms`
- `status` ('pending_approval' | 'approved' | 'rejected' | 'no_runner_up')
- `requested_by`, `approved_by`, `approval_notes`, `new_po_id`
- RLS: org-scoped; only procurement/admin can update.

**Runner-up selection (DB function `select_rfp_runner_up(rfp_id)`)**:
- Returns the `rfp_proposals` row with the highest `weighted_score` excluding the current `awarded_proposal_id` and any vendor that already rejected a PO from this RFP.
- If none found, status = `no_runner_up` and notification asks procurement to re-open the RFP manually.

**UI — new "PO Re-Award" panel** in Procurement section (`/purchase-orders` or RFP detail):
- Lists pending `po_reaward_requests` with original PO #, runner-up vendor, runner-up total, payment terms.
- Approve button → calls DB function `approve_po_reaward(request_id, notes)`:
  - Creates a new PO using runner-up proposal's prices (per `rfp_proposal_lines` if present, else proportional from `total_amount`) and `payment_milestones` serialized into `payment_terms`.
  - Sets `purchase_orders.rfp_id` and links back; `status = 'approved'`, `acceptance_status = 'pending'`.
  - Updates `rfps.awarded_vendor_id` / `awarded_proposal_id` to runner-up.
  - Marks request `approved`, stores `new_po_id`.
  - Notifies the new vendor's portal users.
- Reject button → DB function `reject_po_reaward(request_id, notes)`: marks request `rejected`, notifies procurement to manually re-open the RFP.

### 4. Vendor Portal UX
- After rejecting, the PO row shows "Cancelled — rejection recorded" and a read-only reason.
- The new awarded vendor sees the new PO in their portal under Purchase Orders, can view/accept/reject as usual (same flow loops).

### Technical Details

**Migrations (in order)**
1. `vendor_po_acknowledgments`: add CHECK constraint for mandatory reason on rejection.
2. Create `po_reaward_requests` table + RLS + indexes.
3. Function `select_rfp_runner_up(p_rfp_id uuid)` SECURITY DEFINER.
4. Function `handle_vendor_po_rejection()` trigger (AFTER INSERT on `vendor_po_acknowledgments`) — cancels PO, releases commitment, notifies, creates reaward request.
5. Function `approve_po_reaward(p_request_id uuid, p_notes text)` SECURITY DEFINER — creates new PO + lines, updates RFP award, notifies vendor portal users.
6. Function `reject_po_reaward(p_request_id uuid, p_notes text)`.

**Frontend changes**
- `src/components/vendor-portal/VendorPOAcceptance.tsx`: enforce min-length reason on rejection, update help text.
- `src/components/purchase-orders/POReawardPanel.tsx` (new): list + approve/reject UI, calls the RPCs.
- Add route/tab on `src/pages/PurchaseOrders.tsx` ("Re-Award Requests" tab) showing the panel with a count badge.
- `src/integrations/supabase/types.ts`: regenerated automatically.

**Edge cases**
- PO not from an RFP → only cancel + notify (no reaward request).
- No runner-up → request created with `no_runner_up` so procurement is prompted to re-open RFP.
- New PO inherits `requisition_id` and ship-to/location from original.
- Audit log entries auto-captured by existing `audit_po_status_change` trigger.


-- ============================================================
-- FIX: Add organization isolation to ALL role-based policies
-- that are missing org_id checks (cross-org data leakage fix)
-- ============================================================

-- === TABLES WITH DIRECT organization_id ===

-- goods_receipts
DROP POLICY IF EXISTS "Warehouse and procurement can manage GRNs" ON goods_receipts;
CREATE POLICY "Warehouse and procurement can manage GRNs" ON goods_receipts FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- purchase_orders
DROP POLICY IF EXISTS "Procurement and admin can manage POs" ON purchase_orders;
CREATE POLICY "Procurement and admin can manage POs" ON purchase_orders FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  );

-- inventory_adjustments
DROP POLICY IF EXISTS "Warehouse and admin can manage adjustments" ON inventory_adjustments;
CREATE POLICY "Warehouse and admin can manage adjustments" ON inventory_adjustments FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
  );

-- inventory_balances
DROP POLICY IF EXISTS "Warehouse and admin can manage inventory_balances" ON inventory_balances;
CREATE POLICY "Warehouse and admin can manage inventory_balances" ON inventory_balances FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- inventory_costing_layers
DROP POLICY IF EXISTS "System can manage inventory_costing_layers" ON inventory_costing_layers;
CREATE POLICY "System can manage inventory_costing_layers" ON inventory_costing_layers FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
  );

-- invoice_holds
DROP POLICY IF EXISTS "AP and admin can manage invoice_holds" ON invoice_holds;
CREATE POLICY "AP and admin can manage invoice_holds" ON invoice_holds FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- match_runs
DROP POLICY IF EXISTS "AP and admin can manage match_runs" ON match_runs;
CREATE POLICY "AP and admin can manage match_runs" ON match_runs FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- reorder_rules
DROP POLICY IF EXISTS "Warehouse and admin can manage reorder_rules" ON reorder_rules;
CREATE POLICY "Warehouse and admin can manage reorder_rules" ON reorder_rules FOR ALL
  USING (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
  );

-- === CHILD TABLES (no org_id, check via parent) ===

-- goods_receipt_lines → goods_receipts
DROP POLICY IF EXISTS "Warehouse and procurement can manage GRN lines" ON goods_receipt_lines;
CREATE POLICY "Warehouse and procurement can manage GRN lines" ON goods_receipt_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.id = goods_receipt_lines.grn_id AND gr.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.id = goods_receipt_lines.grn_id AND gr.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- purchase_order_lines → purchase_orders
DROP POLICY IF EXISTS "Procurement and admin can manage PO lines" ON purchase_order_lines;
CREATE POLICY "Procurement and admin can manage PO lines" ON purchase_order_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_lines.po_id AND po.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_lines.po_id AND po.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- ap_invoice_lines → ap_invoices
DROP POLICY IF EXISTS "AP and procurement can manage invoice lines" ON ap_invoice_lines;
CREATE POLICY "AP and procurement can manage invoice lines" ON ap_invoice_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ap_invoices inv WHERE inv.id = ap_invoice_lines.invoice_id AND inv.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ap_invoices inv WHERE inv.id = ap_invoice_lines.invoice_id AND inv.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- ap_payment_allocations → ap_payments
DROP POLICY IF EXISTS "AP and admin can manage ap_payment_allocations" ON ap_payment_allocations;
CREATE POLICY "AP and admin can manage ap_payment_allocations" ON ap_payment_allocations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ap_payments p WHERE p.id = ap_payment_allocations.payment_id AND p.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ap_payments p WHERE p.id = ap_payment_allocations.payment_id AND p.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- approval_steps → approval_rules
DROP POLICY IF EXISTS "Admin can manage approval_steps" ON approval_steps;
CREATE POLICY "Admin can manage approval_steps" ON approval_steps FOR ALL
  USING (
    EXISTS (SELECT 1 FROM approval_rules r WHERE r.id = approval_steps.rule_id AND r.organization_id = get_user_org_id())
    AND has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM approval_rules r WHERE r.id = approval_steps.rule_id AND r.organization_id = get_user_org_id())
    AND has_role(auth.uid(), 'admin')
  );

-- ar_credit_note_lines → ar_credit_notes
DROP POLICY IF EXISTS "Finance and admin can manage ar_credit_note_lines" ON ar_credit_note_lines;
CREATE POLICY "Finance and admin can manage ar_credit_note_lines" ON ar_credit_note_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ar_credit_notes cn WHERE cn.id = ar_credit_note_lines.credit_note_id AND cn.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ar_credit_notes cn WHERE cn.id = ar_credit_note_lines.credit_note_id AND cn.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- ar_invoice_lines → ar_invoices
DROP POLICY IF EXISTS "Finance and admin can manage ar_invoice_lines" ON ar_invoice_lines;
CREATE POLICY "Finance and admin can manage ar_invoice_lines" ON ar_invoice_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ar_invoices inv WHERE inv.id = ar_invoice_lines.invoice_id AND inv.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ar_invoices inv WHERE inv.id = ar_invoice_lines.invoice_id AND inv.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- ar_receipt_allocations → ar_receipts
DROP POLICY IF EXISTS "Finance and admin can manage ar_receipt_allocations" ON ar_receipt_allocations;
CREATE POLICY "Finance and admin can manage ar_receipt_allocations" ON ar_receipt_allocations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ar_receipts r WHERE r.id = ar_receipt_allocations.receipt_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ar_receipts r WHERE r.id = ar_receipt_allocations.receipt_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- budget_lines → budgets
DROP POLICY IF EXISTS "Admin and procurement can manage budget_lines" ON budget_lines;
CREATE POLICY "Admin and procurement can manage budget_lines" ON budget_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM budgets b WHERE b.id = budget_lines.budget_id AND b.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM budgets b WHERE b.id = budget_lines.budget_id AND b.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- budget_consumption → budget_lines → budgets
DROP POLICY IF EXISTS "System can manage budget_consumption" ON budget_consumption;
CREATE POLICY "System can manage budget_consumption" ON budget_consumption FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM budget_lines bl 
      JOIN budgets b ON b.id = bl.budget_id 
      WHERE bl.id = budget_consumption.budget_line_id AND b.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_lines bl 
      JOIN budgets b ON b.id = bl.budget_id 
      WHERE bl.id = budget_consumption.budget_line_id AND b.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable'))
  );

-- delivery_note_lines → delivery_notes
DROP POLICY IF EXISTS "Sales and admin can manage dn_lines" ON delivery_note_lines;
CREATE POLICY "Sales and admin can manage dn_lines" ON delivery_note_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM delivery_notes dn WHERE dn.id = delivery_note_lines.dn_id AND dn.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM delivery_notes dn WHERE dn.id = delivery_note_lines.dn_id AND dn.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- gl_account_balances → gl_accounts (has org_id)
DROP POLICY IF EXISTS "System can manage gl_account_balances" ON gl_account_balances;
CREATE POLICY "System can manage gl_account_balances" ON gl_account_balances FOR ALL
  USING (
    EXISTS (SELECT 1 FROM gl_accounts a WHERE a.id = gl_account_balances.account_id AND a.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM gl_accounts a WHERE a.id = gl_account_balances.account_id AND a.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
  );

-- gl_journal_lines → gl_journal_entries
DROP POLICY IF EXISTS "Finance roles can manage gl_journal_lines" ON gl_journal_lines;
CREATE POLICY "Finance roles can manage gl_journal_lines" ON gl_journal_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM gl_journal_entries je WHERE je.id = gl_journal_lines.journal_entry_id AND je.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM gl_journal_entries je WHERE je.id = gl_journal_lines.journal_entry_id AND je.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- inventory_adjustment_lines → inventory_adjustments
DROP POLICY IF EXISTS "Warehouse and admin can manage adjustment_lines" ON inventory_adjustment_lines;
CREATE POLICY "Warehouse and admin can manage adjustment_lines" ON inventory_adjustment_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM inventory_adjustments ia WHERE ia.id = inventory_adjustment_lines.adjustment_id AND ia.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM inventory_adjustments ia WHERE ia.id = inventory_adjustment_lines.adjustment_id AND ia.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- inventory_costing_consumptions → inventory_costing_layers
DROP POLICY IF EXISTS "System can manage inventory_costing_consumptions" ON inventory_costing_consumptions;
CREATE POLICY "System can manage inventory_costing_consumptions" ON inventory_costing_consumptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM inventory_costing_layers l WHERE l.id = inventory_costing_consumptions.layer_id AND l.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM inventory_costing_layers l WHERE l.id = inventory_costing_consumptions.layer_id AND l.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
  );

-- inventory_reservations → purchase_order_lines → purchase_orders (use location which has org_id)
DROP POLICY IF EXISTS "Warehouse and admin can manage reservations" ON inventory_reservations;
CREATE POLICY "Warehouse and admin can manage reservations" ON inventory_reservations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM locations l WHERE l.id = inventory_reservations.location_id AND l.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM locations l WHERE l.id = inventory_reservations.location_id AND l.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  );

-- match_lines → match_runs
DROP POLICY IF EXISTS "AP and admin can manage match_lines" ON match_lines;
CREATE POLICY "AP and admin can manage match_lines" ON match_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM match_runs mr WHERE mr.id = match_lines.match_run_id AND mr.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM match_runs mr WHERE mr.id = match_lines.match_run_id AND mr.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- requisition_lines → requisitions
DROP POLICY IF EXISTS "Users can manage own requisition lines" ON requisition_lines;
CREATE POLICY "Users can manage own requisition lines" ON requisition_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_lines.requisition_id AND r.organization_id = get_user_org_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_lines.requisition_id AND r.organization_id = get_user_org_id())
  );

-- sales_order_lines → sales_orders
DROP POLICY IF EXISTS "Sales and admin can manage so_lines" ON sales_order_lines;
CREATE POLICY "Sales and admin can manage so_lines" ON sales_order_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_lines.order_id AND so.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_lines.order_id AND so.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

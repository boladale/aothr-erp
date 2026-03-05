-- Update RLS policies for new officer roles

-- Procurement officers can manage vendors, POs, RFPs
DROP POLICY IF EXISTS "Procurement and admin can manage vendors" ON public.vendors;
CREATE POLICY "Procurement and admin can manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'));

DROP POLICY IF EXISTS "Procurement and admin can manage POs" ON public.purchase_orders;
CREATE POLICY "Procurement and admin can manage POs" ON public.purchase_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'));

DROP POLICY IF EXISTS "Procurement and admin can manage rfps" ON public.rfps;
CREATE POLICY "Procurement and admin can manage rfps" ON public.rfps FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'));

DROP POLICY IF EXISTS "Procurement and admin can manage rfp_items" ON public.rfp_items;
CREATE POLICY "Procurement and admin can manage rfp_items" ON public.rfp_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'procurement_officer'));

-- Warehouse officers can manage GRNs, inventory
DROP POLICY IF EXISTS "Warehouse and procurement can manage GRNs" ON public.goods_receipts;
CREATE POLICY "Warehouse and procurement can manage GRNs" ON public.goods_receipts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

DROP POLICY IF EXISTS "Warehouse and procurement can manage GRN lines" ON public.goods_receipt_lines;
CREATE POLICY "Warehouse and procurement can manage GRN lines" ON public.goods_receipt_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

DROP POLICY IF EXISTS "Warehouse and admin can manage inventory_balances" ON public.inventory_balances;
CREATE POLICY "Warehouse and admin can manage inventory_balances" ON public.inventory_balances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

DROP POLICY IF EXISTS "Warehouse and admin can manage adjustment_lines" ON public.inventory_adjustment_lines;
CREATE POLICY "Warehouse and admin can manage adjustment_lines" ON public.inventory_adjustment_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

DROP POLICY IF EXISTS "Warehouse and admin can manage reservations" ON public.inventory_reservations;
CREATE POLICY "Warehouse and admin can manage reservations" ON public.inventory_reservations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

DROP POLICY IF EXISTS "Warehouse and admin can manage reorder_rules" ON public.reorder_rules;
CREATE POLICY "Warehouse and admin can manage reorder_rules" ON public.reorder_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

-- AP clerks can manage invoices
DROP POLICY IF EXISTS "AP and procurement can manage invoice lines" ON public.ap_invoice_lines;
CREATE POLICY "AP and procurement can manage invoice lines" ON public.ap_invoice_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

DROP POLICY IF EXISTS "AP and admin can manage match_runs" ON public.match_runs;
CREATE POLICY "AP and admin can manage match_runs" ON public.match_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

DROP POLICY IF EXISTS "AP and admin can manage invoice_holds" ON public.invoice_holds;
CREATE POLICY "AP and admin can manage invoice_holds" ON public.invoice_holds FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

DROP POLICY IF EXISTS "AP and admin can manage invoice_approvals" ON public.invoice_approvals;
CREATE POLICY "AP and admin can manage invoice_approvals" ON public.invoice_approvals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));
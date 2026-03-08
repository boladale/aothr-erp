
-- Phase 3: Update RLS policies to include organization_id filtering
-- Strategy: Drop and recreate policies with org filter on key tables

-- VENDORS
DROP POLICY IF EXISTS "Auth users can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Procurement and admin can manage vendors" ON public.vendors;
CREATE POLICY "Users can view org vendors" ON public.vendors FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Procurement and admin can manage vendors" ON public.vendors FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- ITEMS
DROP POLICY IF EXISTS "Auth users can view items" ON public.items;
DROP POLICY IF EXISTS "Procurement and admin can manage items" ON public.items;
CREATE POLICY "Users can view org items" ON public.items FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org items" ON public.items FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- LOCATIONS
DROP POLICY IF EXISTS "Auth users can view locations" ON public.locations;
DROP POLICY IF EXISTS "Admin can manage locations" ON public.locations;
CREATE POLICY "Users can view org locations" ON public.locations FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org locations" ON public.locations FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "Auth users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Finance and admin can manage customers" ON public.customers;
CREATE POLICY "Users can view org customers" ON public.customers FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org customers" ON public.customers FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- PURCHASE ORDERS
DROP POLICY IF EXISTS "Auth users can view purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Procurement and admin can manage purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can view org POs" ON public.purchase_orders FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org POs" ON public.purchase_orders FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- REQUISITIONS
DROP POLICY IF EXISTS "Auth users can view requisitions" ON public.requisitions;
DROP POLICY IF EXISTS "Auth users can manage their requisitions" ON public.requisitions;
CREATE POLICY "Users can view org requisitions" ON public.requisitions FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org requisitions" ON public.requisitions FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AP INVOICES
DROP POLICY IF EXISTS "Auth users can view ap_invoices" ON public.ap_invoices;
DROP POLICY IF EXISTS "AP and procurement can manage invoices" ON public.ap_invoices;
CREATE POLICY "Users can view org ap_invoices" ON public.ap_invoices FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org ap_invoices" ON public.ap_invoices FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AR INVOICES
DROP POLICY IF EXISTS "Auth users can view ar_invoices" ON public.ar_invoices;
DROP POLICY IF EXISTS "Finance and admin can manage ar_invoices" ON public.ar_invoices;
CREATE POLICY "Users can view org ar_invoices" ON public.ar_invoices FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org ar_invoices" ON public.ar_invoices FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- GOODS RECEIPTS
DROP POLICY IF EXISTS "Auth users can view goods_receipts" ON public.goods_receipts;
DROP POLICY IF EXISTS "Warehouse and admin can manage goods_receipts" ON public.goods_receipts;
CREATE POLICY "Users can view org GRNs" ON public.goods_receipts FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org GRNs" ON public.goods_receipts FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- GL ACCOUNTS
DROP POLICY IF EXISTS "Auth users can view gl_accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Finance roles can manage gl_accounts" ON public.gl_accounts;
CREATE POLICY "Users can view org gl_accounts" ON public.gl_accounts FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org gl_accounts" ON public.gl_accounts FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- GL JOURNAL ENTRIES
DROP POLICY IF EXISTS "Auth users can view gl_journal_entries" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "Finance roles can manage gl_journal_entries" ON public.gl_journal_entries;
CREATE POLICY "Users can view org journal entries" ON public.gl_journal_entries FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org journal entries" ON public.gl_journal_entries FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- GL FISCAL PERIODS
DROP POLICY IF EXISTS "Auth users can view gl_fiscal_periods" ON public.gl_fiscal_periods;
DROP POLICY IF EXISTS "Admin can manage gl_fiscal_periods" ON public.gl_fiscal_periods;
CREATE POLICY "Users can view org fiscal periods" ON public.gl_fiscal_periods FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org fiscal periods" ON public.gl_fiscal_periods FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can view own org notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() AND organization_id = public.get_user_org_id());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

-- SALES ORDERS
DROP POLICY IF EXISTS "Auth users can view sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Sales and admin can manage sales_orders" ON public.sales_orders;
CREATE POLICY "Users can view org sales_orders" ON public.sales_orders FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org sales_orders" ON public.sales_orders FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- BANK ACCOUNTS
DROP POLICY IF EXISTS "Auth users can view bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Finance can manage bank_accounts" ON public.bank_accounts;
CREATE POLICY "Users can view org bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- RFPS
DROP POLICY IF EXISTS "Auth users can view rfps" ON public.rfps;
DROP POLICY IF EXISTS "Procurement and admin can manage rfps" ON public.rfps;
CREATE POLICY "Users can view org rfps" ON public.rfps FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org rfps" ON public.rfps FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- INVENTORY BALANCES
DROP POLICY IF EXISTS "Auth users can view inventory_balances" ON public.inventory_balances;
DROP POLICY IF EXISTS "Warehouse can manage inventory_balances" ON public.inventory_balances;
CREATE POLICY "Users can view org inventory" ON public.inventory_balances FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org inventory" ON public.inventory_balances FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- PROJECTS
DROP POLICY IF EXISTS "Auth users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admin and managers can manage projects" ON public.projects;
CREATE POLICY "Users can view org projects" ON public.projects FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org projects" ON public.projects FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- BUDGETS
DROP POLICY IF EXISTS "Auth users can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "Admin and procurement can manage budgets" ON public.budgets;
CREATE POLICY "Users can view org budgets" ON public.budgets FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org budgets" ON public.budgets FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- APPROVAL RULES
DROP POLICY IF EXISTS "Auth users can view approval_rules" ON public.approval_rules;
DROP POLICY IF EXISTS "Admin can manage approval_rules" ON public.approval_rules;
CREATE POLICY "Users can view org approval_rules" ON public.approval_rules FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org approval_rules" ON public.approval_rules FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AP PAYMENTS
DROP POLICY IF EXISTS "Auth users can view ap_payments" ON public.ap_payments;
DROP POLICY IF EXISTS "AP and admin can manage ap_payments" ON public.ap_payments;
CREATE POLICY "Users can view org ap_payments" ON public.ap_payments FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org ap_payments" ON public.ap_payments FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AR RECEIPTS
DROP POLICY IF EXISTS "Auth users can view ar_receipts" ON public.ar_receipts;
DROP POLICY IF EXISTS "Finance and admin can manage ar_receipts" ON public.ar_receipts;
CREATE POLICY "Users can view org ar_receipts" ON public.ar_receipts FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org ar_receipts" ON public.ar_receipts FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AR CREDIT NOTES
DROP POLICY IF EXISTS "Auth users can view ar_credit_notes" ON public.ar_credit_notes;
DROP POLICY IF EXISTS "Finance and admin can manage ar_credit_notes" ON public.ar_credit_notes;
CREATE POLICY "Users can view org ar_credit_notes" ON public.ar_credit_notes FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org ar_credit_notes" ON public.ar_credit_notes FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- FUND TRANSFERS
DROP POLICY IF EXISTS "Auth users can view fund_transfers" ON public.fund_transfers;
DROP POLICY IF EXISTS "Finance can manage fund_transfers" ON public.fund_transfers;
CREATE POLICY "Users can view org fund_transfers" ON public.fund_transfers FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org fund_transfers" ON public.fund_transfers FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- SALES QUOTATIONS
DROP POLICY IF EXISTS "Auth users can view sales_quotations" ON public.sales_quotations;
DROP POLICY IF EXISTS "Sales and admin can manage sales_quotations" ON public.sales_quotations;
CREATE POLICY "Users can view org quotations" ON public.sales_quotations FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org quotations" ON public.sales_quotations FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- DELIVERY NOTES
DROP POLICY IF EXISTS "Auth users can view delivery_notes" ON public.delivery_notes;
DROP POLICY IF EXISTS "Sales and admin can manage delivery_notes" ON public.delivery_notes;
CREATE POLICY "Users can view org delivery_notes" ON public.delivery_notes FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org delivery_notes" ON public.delivery_notes FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- TAX GROUPS
DROP POLICY IF EXISTS "Auth users can view tax_groups" ON public.tax_groups;
DROP POLICY IF EXISTS "Admin can manage tax_groups" ON public.tax_groups;
CREATE POLICY "Users can view org tax_groups" ON public.tax_groups FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org tax_groups" ON public.tax_groups FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- INVENTORY ADJUSTMENTS
DROP POLICY IF EXISTS "Auth users can view inventory_adjustments" ON public.inventory_adjustments;
DROP POLICY IF EXISTS "Warehouse can manage inventory_adjustments" ON public.inventory_adjustments;
CREATE POLICY "Users can view org adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org adjustments" ON public.inventory_adjustments FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- BANK TRANSACTIONS
DROP POLICY IF EXISTS "Auth users can view bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Finance can manage bank_transactions" ON public.bank_transactions;
CREATE POLICY "Users can view org bank_txns" ON public.bank_transactions FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org bank_txns" ON public.bank_transactions FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- BANK RECONCILIATIONS
DROP POLICY IF EXISTS "Auth users can view bank_reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Finance can manage bank_reconciliations" ON public.bank_reconciliations;
CREATE POLICY "Users can view org reconciliations" ON public.bank_reconciliations FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org reconciliations" ON public.bank_reconciliations FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- AUDIT LOGS
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view org audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id());

-- ROLES (custom roles per org)
DROP POLICY IF EXISTS "Auth users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.roles;
CREATE POLICY "Users can view org roles" ON public.roles FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id());
CREATE POLICY "Auth users can manage org roles" ON public.roles FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

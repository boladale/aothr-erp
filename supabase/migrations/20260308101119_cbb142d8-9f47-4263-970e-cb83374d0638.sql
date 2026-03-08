
-- Phase 2A: Add organization_id to all master data tables
-- Using nullable initially for backward compatibility with existing data

-- Master data tables
ALTER TABLE public.vendors ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.items ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.locations ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.customers ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.gl_accounts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.gl_fiscal_periods ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.bank_accounts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tax_groups ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tax_rates ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.item_tax_mappings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.approval_rules ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.budgets ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.projects ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.reorder_rules ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Transactional parent tables
ALTER TABLE public.purchase_orders ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.requisitions ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ap_invoices ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ap_payments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ar_invoices ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ar_receipts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ar_credit_notes ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.goods_receipts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.gl_journal_entries ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.inventory_balances ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.inventory_adjustments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.inventory_costing_layers ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.match_runs ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.invoice_holds ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.invoice_approvals ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.approval_instances ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.bank_transactions ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.bank_reconciliations ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.fund_transfers ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.sales_orders ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.sales_quotations ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.delivery_notes ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.rfps ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vendor_ratings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vendor_approvals ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vendor_contacts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vendor_documents ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.po_approvals ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.transaction_attachments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project_costs ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project_revenues ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.revenue_recognition_schedules ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.revenue_recognition_entries ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Indexes for performance on org_id filtering
CREATE INDEX idx_vendors_org ON public.vendors(organization_id);
CREATE INDEX idx_items_org ON public.items(organization_id);
CREATE INDEX idx_locations_org ON public.locations(organization_id);
CREATE INDEX idx_customers_org ON public.customers(organization_id);
CREATE INDEX idx_purchase_orders_org ON public.purchase_orders(organization_id);
CREATE INDEX idx_requisitions_org ON public.requisitions(organization_id);
CREATE INDEX idx_ap_invoices_org ON public.ap_invoices(organization_id);
CREATE INDEX idx_ar_invoices_org ON public.ar_invoices(organization_id);
CREATE INDEX idx_goods_receipts_org ON public.goods_receipts(organization_id);
CREATE INDEX idx_gl_journal_entries_org ON public.gl_journal_entries(organization_id);
CREATE INDEX idx_gl_accounts_org ON public.gl_accounts(organization_id);
CREATE INDEX idx_inventory_balances_org ON public.inventory_balances(organization_id);
CREATE INDEX idx_sales_orders_org ON public.sales_orders(organization_id);
CREATE INDEX idx_rfps_org ON public.rfps(organization_id);
CREATE INDEX idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);


-- Auto-populate organization_id on INSERT for all tenant-scoped tables
-- This uses the get_user_org_id() function already created

CREATE OR REPLACE FUNCTION public.auto_set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_org_id();
  END IF;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required. User must belong to an organization.';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to all tenant-scoped tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'vendors', 'items', 'locations', 'inventory_balances',
    'purchase_orders', 'purchase_order_lines',
    'goods_receipts', 'goods_receipt_lines',
    'ap_invoices', 'ap_invoice_lines',
    'ap_payments', 'ap_payment_allocations',
    'requisitions', 'requisition_lines',
    'notifications', 'audit_logs',
    'approval_rules', 'approval_instances', 'approval_actions', 'approval_steps',
    'budgets', 'budget_lines', 'budget_consumption',
    'match_runs', 'match_lines', 'invoice_holds',
    'inventory_adjustments', 'inventory_adjustment_lines',
    'inventory_reservations', 'reorder_rules',
    'rfps', 'rfp_proposals', 'rfp_evaluation_criteria', 'rfp_evaluations',
    'gl_accounts', 'gl_journal_entries', 'gl_journal_lines',
    'gl_fiscal_periods', 'gl_account_balances',
    'customers',
    'ar_invoices', 'ar_invoice_lines',
    'ar_receipts', 'ar_receipt_allocations',
    'ar_credit_notes', 'ar_credit_note_lines',
    'bank_accounts', 'bank_transactions', 'bank_reconciliations',
    'fund_transfers',
    'tax_groups', 'tax_rates',
    'sales_quotations', 'sales_quotation_lines',
    'sales_orders', 'sales_order_lines',
    'delivery_notes', 'delivery_note_lines',
    'projects', 'project_costs', 'project_revenues',
    'inventory_costing_layers', 'inventory_costing_consumptions',
    'vendor_documents',
    'roles', 'role_permissions', 'permissions', 'app_role_permissions',
    'po_line_requisition_lines'
  ];
BEGIN
  FOR i IN 1..array_length(tables, 1) LOOP
    tbl := tables[i];
    -- Only create trigger if table has organization_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organization_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_auto_org_id ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER tr_auto_org_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id()',
        tbl
      );
    END IF;
  END LOOP;
END;
$$;


-- =====================================================
-- ORG-SCOPE ALL RLS SELECT POLICIES
-- =====================================================

-- 1. PROFILES: Admins see same-org profiles only
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id());

-- Keep "Users can view own profile" as fallback

-- 2. USER_ROLES: Admins manage same-org user roles only
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage org user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_org_id()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_org_id()
    )
  );

-- 3. TABLES WITH organization_id: replace qual:true SELECT with org-scoped

-- approval_instances
DROP POLICY IF EXISTS "Auth users can view approval_instances" ON public.approval_instances;
CREATE POLICY "Users can view org approval_instances" ON public.approval_instances
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- inventory_costing_layers
DROP POLICY IF EXISTS "Auth users can view inventory_costing_layers" ON public.inventory_costing_layers;
CREATE POLICY "Users can view org costing_layers" ON public.inventory_costing_layers
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- invoice_approvals
DROP POLICY IF EXISTS "Auth users can view invoice_approvals" ON public.invoice_approvals;
CREATE POLICY "Users can view org invoice_approvals" ON public.invoice_approvals
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- invoice_holds
DROP POLICY IF EXISTS "Auth users can view invoice_holds" ON public.invoice_holds;
CREATE POLICY "Users can view org invoice_holds" ON public.invoice_holds
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- item_tax_mappings
DROP POLICY IF EXISTS "Auth users can view item_tax_mappings" ON public.item_tax_mappings;
CREATE POLICY "Users can view org item_tax_mappings" ON public.item_tax_mappings
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- match_runs
DROP POLICY IF EXISTS "Auth users can view match_runs" ON public.match_runs;
CREATE POLICY "Users can view org match_runs" ON public.match_runs
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- po_approvals
DROP POLICY IF EXISTS "Auth users can view po_approvals" ON public.po_approvals;
CREATE POLICY "Users can view org po_approvals" ON public.po_approvals
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- project_costs
DROP POLICY IF EXISTS "Auth users can view project_costs" ON public.project_costs;
CREATE POLICY "Users can view org project_costs" ON public.project_costs
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- project_revenues
DROP POLICY IF EXISTS "Auth users can view project_revenues" ON public.project_revenues;
CREATE POLICY "Users can view org project_revenues" ON public.project_revenues
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- reorder_rules
DROP POLICY IF EXISTS "Auth users can view reorder_rules" ON public.reorder_rules;
CREATE POLICY "Users can view org reorder_rules" ON public.reorder_rules
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- revenue_recognition_entries
DROP POLICY IF EXISTS "Auth users can view rev_rec_entries" ON public.revenue_recognition_entries;
CREATE POLICY "Users can view org rev_rec_entries" ON public.revenue_recognition_entries
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- revenue_recognition_schedules
DROP POLICY IF EXISTS "Auth users can view rev_rec_schedules" ON public.revenue_recognition_schedules;
CREATE POLICY "Users can view org rev_rec_schedules" ON public.revenue_recognition_schedules
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- tax_rates
DROP POLICY IF EXISTS "Auth users can view tax_rates" ON public.tax_rates;
CREATE POLICY "Users can view org tax_rates" ON public.tax_rates
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- transaction_attachments
DROP POLICY IF EXISTS "Auth users can view attachments" ON public.transaction_attachments;
CREATE POLICY "Users can view org attachments" ON public.transaction_attachments
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- vendor_approvals
DROP POLICY IF EXISTS "Auth users can view vendor_approvals" ON public.vendor_approvals;
CREATE POLICY "Users can view org vendor_approvals" ON public.vendor_approvals
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- vendor_contacts
DROP POLICY IF EXISTS "Auth users can view vendor_contacts" ON public.vendor_contacts;
CREATE POLICY "Users can view org vendor_contacts" ON public.vendor_contacts
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- vendor_documents
DROP POLICY IF EXISTS "Auth users can view vendor_documents" ON public.vendor_documents;
CREATE POLICY "Users can view org vendor_documents" ON public.vendor_documents
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- vendor_ratings
DROP POLICY IF EXISTS "Auth users can view vendor_ratings" ON public.vendor_ratings;
CREATE POLICY "Users can view org vendor_ratings" ON public.vendor_ratings
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());

-- 4. CHILD TABLES WITHOUT org_id: scope via parent

-- ap_invoice_lines → ap_invoices
DROP POLICY IF EXISTS "Auth users can view ap_invoice_lines" ON public.ap_invoice_lines;
CREATE POLICY "Users can view org ap_invoice_lines" ON public.ap_invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_invoices i WHERE i.id = invoice_id AND i.organization_id = get_user_org_id()
  ));

-- ap_payment_allocations → ap_payments
DROP POLICY IF EXISTS "Auth users can view ap_payment_allocations" ON public.ap_payment_allocations;
CREATE POLICY "Users can view org ap_payment_allocations" ON public.ap_payment_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_payments p WHERE p.id = payment_id AND p.organization_id = get_user_org_id()
  ));

-- approval_actions → approval_instances
DROP POLICY IF EXISTS "Auth users can view approval_actions" ON public.approval_actions;
CREATE POLICY "Users can view org approval_actions" ON public.approval_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.approval_instances ai WHERE ai.id = instance_id AND ai.organization_id = get_user_org_id()
  ));

-- approval_steps → approval_rules
DROP POLICY IF EXISTS "Auth users can view approval_steps" ON public.approval_steps;
CREATE POLICY "Users can view org approval_steps" ON public.approval_steps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.approval_rules ar WHERE ar.id = rule_id AND ar.organization_id = get_user_org_id()
  ));

-- ar_credit_note_lines → ar_credit_notes
DROP POLICY IF EXISTS "Auth users can view ar_credit_note_lines" ON public.ar_credit_note_lines;
CREATE POLICY "Users can view org ar_credit_note_lines" ON public.ar_credit_note_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ar_credit_notes cn WHERE cn.id = credit_note_id AND cn.organization_id = get_user_org_id()
  ));

-- ar_invoice_lines → ar_invoices
DROP POLICY IF EXISTS "Auth users can view ar_invoice_lines" ON public.ar_invoice_lines;
CREATE POLICY "Users can view org ar_invoice_lines" ON public.ar_invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ar_invoices i WHERE i.id = invoice_id AND i.organization_id = get_user_org_id()
  ));

-- ar_receipt_allocations → ar_receipts
DROP POLICY IF EXISTS "Auth users can view ar_receipt_allocations" ON public.ar_receipt_allocations;
CREATE POLICY "Users can view org ar_receipt_allocations" ON public.ar_receipt_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ar_receipts r WHERE r.id = receipt_id AND r.organization_id = get_user_org_id()
  ));

-- budget_lines → budgets
DROP POLICY IF EXISTS "Auth users can view budget_lines" ON public.budget_lines;
CREATE POLICY "Users can view org budget_lines" ON public.budget_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.organization_id = get_user_org_id()
  ));

-- budget_consumption → budget_lines → budgets
DROP POLICY IF EXISTS "Auth users can view budget_consumption" ON public.budget_consumption;
CREATE POLICY "Users can view org budget_consumption" ON public.budget_consumption
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.budget_lines bl
    JOIN public.budgets b ON b.id = bl.budget_id
    WHERE bl.id = budget_line_id AND b.organization_id = get_user_org_id()
  ));

-- delivery_note_lines → delivery_notes
DROP POLICY IF EXISTS "Auth users can view delivery_note_lines" ON public.delivery_note_lines;
CREATE POLICY "Users can view org delivery_note_lines" ON public.delivery_note_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_notes dn WHERE dn.id = dn_id AND dn.organization_id = get_user_org_id()
  ));

-- gl_account_balances → gl_accounts
DROP POLICY IF EXISTS "Auth users can view gl_account_balances" ON public.gl_account_balances;
CREATE POLICY "Users can view org gl_account_balances" ON public.gl_account_balances
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gl_accounts a WHERE a.id = account_id AND a.organization_id = get_user_org_id()
  ));

-- gl_journal_lines → gl_journal_entries
DROP POLICY IF EXISTS "Auth users can view gl_journal_lines" ON public.gl_journal_lines;
CREATE POLICY "Users can view org gl_journal_lines" ON public.gl_journal_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gl_journal_entries je WHERE je.id = journal_entry_id AND je.organization_id = get_user_org_id()
  ));

-- goods_receipt_lines → goods_receipts
DROP POLICY IF EXISTS "Auth users can view goods_receipt_lines" ON public.goods_receipt_lines;
CREATE POLICY "Users can view org goods_receipt_lines" ON public.goods_receipt_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.goods_receipts gr WHERE gr.id = grn_id AND gr.organization_id = get_user_org_id()
  ));

-- inventory_adjustment_lines → inventory_adjustments
DROP POLICY IF EXISTS "Auth users can view inventory_adjustment_lines" ON public.inventory_adjustment_lines;
CREATE POLICY "Users can view org inv_adj_lines" ON public.inventory_adjustment_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inventory_adjustments ia WHERE ia.id = adjustment_id AND ia.organization_id = get_user_org_id()
  ));

-- inventory_costing_consumptions → inventory_costing_layers
DROP POLICY IF EXISTS "Auth users can view inventory_costing_consumptions" ON public.inventory_costing_consumptions;
CREATE POLICY "Users can view org costing_consumptions" ON public.inventory_costing_consumptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inventory_costing_layers cl WHERE cl.id = layer_id AND cl.organization_id = get_user_org_id()
  ));

-- inventory_reservations → inventory_balances (via item_id + location_id)
DROP POLICY IF EXISTS "Auth users can view inventory_reservations" ON public.inventory_reservations;
CREATE POLICY "Users can view org inventory_reservations" ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inventory_balances ib 
    WHERE ib.item_id = inventory_reservations.item_id 
    AND ib.location_id = inventory_reservations.location_id 
    AND ib.organization_id = get_user_org_id()
  ));

-- match_lines → match_runs
DROP POLICY IF EXISTS "Auth users can view match_lines" ON public.match_lines;
CREATE POLICY "Users can view org match_lines" ON public.match_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_runs mr WHERE mr.id = match_run_id AND mr.organization_id = get_user_org_id()
  ));

-- purchase_order_lines → purchase_orders
DROP POLICY IF EXISTS "Auth users can view purchase_order_lines" ON public.purchase_order_lines;
CREATE POLICY "Users can view org po_lines" ON public.purchase_order_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.organization_id = get_user_org_id()
  ));

-- rfp_criteria → rfps
DROP POLICY IF EXISTS "Auth users can view rfp_criteria" ON public.rfp_criteria;
CREATE POLICY "Users can view org rfp_criteria" ON public.rfp_criteria
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND r.organization_id = get_user_org_id()
  ));

-- rfp_items → rfps
DROP POLICY IF EXISTS "Auth users can view rfp_items" ON public.rfp_items;
CREATE POLICY "Users can view org rfp_items" ON public.rfp_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND r.organization_id = get_user_org_id()
  ));

-- rfp_proposals → rfps
DROP POLICY IF EXISTS "Auth users can view rfp_proposals" ON public.rfp_proposals;
CREATE POLICY "Users can view org rfp_proposals" ON public.rfp_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfps r WHERE r.id = rfp_id AND r.organization_id = get_user_org_id()
  ));

-- rfp_proposal_lines → rfp_proposals → rfps
DROP POLICY IF EXISTS "Auth users can view rfp_proposal_lines" ON public.rfp_proposal_lines;
CREATE POLICY "Users can view org rfp_proposal_lines" ON public.rfp_proposal_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfp_proposals rp
    JOIN public.rfps r ON r.id = rp.rfp_id
    WHERE rp.id = proposal_id AND r.organization_id = get_user_org_id()
  ));

-- rfp_scores → rfp_proposals → rfps  
DROP POLICY IF EXISTS "Auth users can view rfp_scores" ON public.rfp_scores;
CREATE POLICY "Users can view org rfp_scores" ON public.rfp_scores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfp_proposals rp
    JOIN public.rfps r ON r.id = rp.rfp_id
    WHERE rp.id = proposal_id AND r.organization_id = get_user_org_id()
  ));

-- role_permissions → roles
DROP POLICY IF EXISTS "Auth users can view role_permissions" ON public.role_permissions;
CREATE POLICY "Users can view org role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roles ro WHERE ro.id = role_id AND ro.organization_id = get_user_org_id()
  ));

-- sales_order_lines → sales_orders
DROP POLICY IF EXISTS "Auth users can view sales_order_lines" ON public.sales_order_lines;
CREATE POLICY "Users can view org sales_order_lines" ON public.sales_order_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders so WHERE so.id = order_id AND so.organization_id = get_user_org_id()
  ));

-- sales_quotation_lines → sales_quotations
DROP POLICY IF EXISTS "Auth users can view sales_quotation_lines" ON public.sales_quotation_lines;
CREATE POLICY "Users can view org sq_lines" ON public.sales_quotation_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_quotations sq WHERE sq.id = quotation_id AND sq.organization_id = get_user_org_id()
  ));

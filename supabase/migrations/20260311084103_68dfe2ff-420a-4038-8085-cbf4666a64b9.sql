
-- ============================================================
-- FIX BATCH 2: Add org isolation to remaining role-based ALL policies
-- ============================================================

-- === TABLES WITH DIRECT organization_id ===

-- locations
DROP POLICY IF EXISTS "Procurement and admin can manage locations" ON locations;
CREATE POLICY "Procurement and admin can manage locations" ON locations FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- invoice_approvals
DROP POLICY IF EXISTS "AP and admin can manage invoice_approvals" ON invoice_approvals;
CREATE POLICY "AP and admin can manage invoice_approvals" ON invoice_approvals FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')));

-- item_tax_mappings
DROP POLICY IF EXISTS "Admin can manage item_tax_mappings" ON item_tax_mappings;
CREATE POLICY "Admin can manage item_tax_mappings" ON item_tax_mappings FOR ALL
  USING (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'));

-- po_approvals
DROP POLICY IF EXISTS "Approvers can manage po_approvals" ON po_approvals;
CREATE POLICY "Approvers can manage po_approvals" ON po_approvals FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- projects
DROP POLICY IF EXISTS "Finance and admin can manage projects" ON projects;
CREATE POLICY "Finance and admin can manage projects" ON projects FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')));

-- project_costs
DROP POLICY IF EXISTS "Finance and admin can manage project_costs" ON project_costs;
CREATE POLICY "Finance and admin can manage project_costs" ON project_costs FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')));

-- project_revenues
DROP POLICY IF EXISTS "Finance and admin can manage project_revenues" ON project_revenues;
CREATE POLICY "Finance and admin can manage project_revenues" ON project_revenues FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')));

-- revenue_recognition_entries
DROP POLICY IF EXISTS "Finance and admin can manage rev_rec_entries" ON revenue_recognition_entries;
CREATE POLICY "Finance and admin can manage rev_rec_entries" ON revenue_recognition_entries FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')));

-- revenue_recognition_schedules
DROP POLICY IF EXISTS "Finance and admin can manage rev_rec_schedules" ON revenue_recognition_schedules;
CREATE POLICY "Finance and admin can manage rev_rec_schedules" ON revenue_recognition_schedules FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable')));

-- tax_rates
DROP POLICY IF EXISTS "Admin can manage tax_rates" ON tax_rates;
CREATE POLICY "Admin can manage tax_rates" ON tax_rates FOR ALL
  USING (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'));

-- vendor_approvals
DROP POLICY IF EXISTS "Approvers can manage vendor_approvals" ON vendor_approvals;
CREATE POLICY "Approvers can manage vendor_approvals" ON vendor_approvals FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- vendor_contacts
DROP POLICY IF EXISTS "Procurement and admin can manage vendor_contacts" ON vendor_contacts;
CREATE POLICY "Procurement and admin can manage vendor_contacts" ON vendor_contacts FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- vendor_documents
DROP POLICY IF EXISTS "Procurement and admin can manage vendor_documents" ON vendor_documents;
CREATE POLICY "Procurement and admin can manage vendor_documents" ON vendor_documents FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- vendor_ratings
DROP POLICY IF EXISTS "Procurement and admin can manage vendor_ratings" ON vendor_ratings;
CREATE POLICY "Procurement and admin can manage vendor_ratings" ON vendor_ratings FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager')));

-- sales_orders
DROP POLICY IF EXISTS "Sales and admin can manage orders" ON sales_orders;
CREATE POLICY "Sales and admin can manage orders" ON sales_orders FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')));

-- sales_quotations
DROP POLICY IF EXISTS "Sales and admin can manage quotations" ON sales_quotations;
CREATE POLICY "Sales and admin can manage quotations" ON sales_quotations FOR ALL
  USING (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')))
  WITH CHECK (organization_id = get_user_org_id() AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')));

-- roles (org-scoped roles table)
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
CREATE POLICY "Admins can manage roles" ON roles FOR ALL
  USING (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_org_id() AND has_role(auth.uid(), 'admin'));

-- === CHILD TABLES (no org_id, check via parent) ===

-- sales_order_lines → sales_orders
DROP POLICY IF EXISTS "Sales and admin can manage order_lines" ON sales_order_lines;
CREATE POLICY "Sales and admin can manage order_lines" ON sales_order_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_lines.order_id AND so.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sales_orders so WHERE so.id = sales_order_lines.order_id AND so.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- sales_quotation_lines → sales_quotations
DROP POLICY IF EXISTS "Sales and admin can manage quotation_lines" ON sales_quotation_lines;
CREATE POLICY "Sales and admin can manage quotation_lines" ON sales_quotation_lines FOR ALL
  USING (
    EXISTS (SELECT 1 FROM sales_quotations sq WHERE sq.id = sales_quotation_lines.quotation_id AND sq.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM sales_quotations sq WHERE sq.id = sales_quotation_lines.quotation_id AND sq.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
  );

-- rfp_criteria → rfps
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_criteria" ON rfp_criteria;
CREATE POLICY "Procurement and admin can manage rfp_criteria" ON rfp_criteria FOR ALL
  USING (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_criteria.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_criteria.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- rfp_items → rfps
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_items" ON rfp_items;
CREATE POLICY "Procurement and admin can manage rfp_items" ON rfp_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_items.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_items.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- rfp_proposals → rfps
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_proposals" ON rfp_proposals;
CREATE POLICY "Procurement and admin can manage rfp_proposals" ON rfp_proposals FOR ALL
  USING (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_proposals.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM rfps r WHERE r.id = rfp_proposals.rfp_id AND r.organization_id = get_user_org_id())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- rfp_proposal_lines → rfp_proposals → rfps
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_proposal_lines" ON rfp_proposal_lines;
CREATE POLICY "Procurement and admin can manage rfp_proposal_lines" ON rfp_proposal_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rfp_proposals p JOIN rfps r ON r.id = p.rfp_id 
      WHERE p.id = rfp_proposal_lines.proposal_id AND r.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfp_proposals p JOIN rfps r ON r.id = p.rfp_id 
      WHERE p.id = rfp_proposal_lines.proposal_id AND r.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- rfp_scores → rfp_proposals → rfps
DROP POLICY IF EXISTS "Procurement and admin can manage rfp_scores" ON rfp_scores;
CREATE POLICY "Procurement and admin can manage rfp_scores" ON rfp_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rfp_proposals p JOIN rfps r ON r.id = p.rfp_id 
      WHERE p.id = rfp_scores.proposal_id AND r.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfp_proposals p JOIN rfps r ON r.id = p.rfp_id 
      WHERE p.id = rfp_scores.proposal_id AND r.organization_id = get_user_org_id()
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  );

-- role_permissions → roles
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON role_permissions;
CREATE POLICY "Admins can manage role_permissions" ON role_permissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id AND r.organization_id = get_user_org_id())
    AND has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM roles r WHERE r.id = role_permissions.role_id AND r.organization_id = get_user_org_id())
    AND has_role(auth.uid(), 'admin')
  );

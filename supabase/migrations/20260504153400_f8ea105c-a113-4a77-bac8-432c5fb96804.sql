CREATE OR REPLACE FUNCTION public.cleanup_transactional_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  TRUNCATE TABLE
    transaction_attachments,
    notifications,
    audit_logs,
    approval_actions,
    approval_instances,
    invoice_holds,
    match_lines,
    match_runs,
    invoice_approvals,
    ap_payment_allocations,
    ap_payments,
    ap_invoice_lines,
    ap_invoices,
    vendor_ratings,
    inventory_costing_consumptions,
    inventory_costing_layers,
    goods_receipt_lines,
    goods_receipts,
    po_line_requisition_lines,
    purchase_order_lines,
    purchase_orders,
    requisition_lines,
    requisitions,
    rfp_scores,
    rfp_proposal_lines,
    rfp_proposals,
    rfp_items,
    rfps,
    ar_receipt_allocations,
    ar_receipts,
    ar_credit_note_lines,
    ar_credit_notes,
    ar_invoice_lines,
    ar_invoices,
    delivery_note_lines,
    delivery_notes,
    sales_order_lines,
    sales_orders,
    sales_quotation_lines,
    sales_quotations,
    gl_journal_lines,
    gl_journal_entries,
    gl_account_balances,
    bank_transactions,
    bank_reconciliations,
    fund_transfers,
    inventory_adjustment_lines,
    inventory_adjustments,
    inventory_reservations,
    inventory_balances,
    budget_consumption,
    revenue_recognition_entries,
    revenue_recognition_schedules,
    project_costs,
    project_revenues,
    projects,
    vendor_approvals,
    vendor_contacts,
    vendor_documents
  RESTART IDENTITY CASCADE;

  UPDATE bank_accounts SET current_balance = opening_balance WHERE id IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_transactional_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM transaction_attachments;
  DELETE FROM notifications;
  DELETE FROM audit_logs;
  DELETE FROM approval_actions;
  DELETE FROM approval_instances;
  DELETE FROM invoice_holds;
  DELETE FROM match_lines;
  DELETE FROM match_runs;
  DELETE FROM invoice_approvals;
  DELETE FROM ap_payment_allocations;
  DELETE FROM ap_payments;
  DELETE FROM ap_invoice_lines;
  DELETE FROM ap_invoices;
  DELETE FROM vendor_ratings;
  DELETE FROM inventory_costing_consumptions;
  DELETE FROM inventory_costing_layers;
  DELETE FROM goods_receipt_lines;
  DELETE FROM goods_receipts;
  DELETE FROM po_line_requisition_lines;
  DELETE FROM purchase_order_lines;
  DELETE FROM purchase_orders;
  DELETE FROM requisition_lines;
  DELETE FROM requisitions;
  DELETE FROM rfp_scores;
  DELETE FROM rfp_proposal_lines;
  DELETE FROM rfp_proposals;
  DELETE FROM rfp_items;
  DELETE FROM rfps;
  DELETE FROM ar_receipt_allocations;
  DELETE FROM ar_receipts;
  DELETE FROM ar_credit_note_lines;
  DELETE FROM ar_credit_notes;
  DELETE FROM ar_invoice_lines;
  DELETE FROM ar_invoices;
  DELETE FROM delivery_note_lines;
  DELETE FROM delivery_notes;
  DELETE FROM sales_order_lines;
  DELETE FROM sales_orders;
  DELETE FROM sales_quotation_lines;
  DELETE FROM sales_quotations;
  DELETE FROM gl_journal_lines;
  DELETE FROM gl_journal_entries;
  DELETE FROM gl_account_balances;
  DELETE FROM bank_transactions;
  DELETE FROM bank_reconciliations;
  DELETE FROM fund_transfers;
  DELETE FROM inventory_adjustment_lines;
  DELETE FROM inventory_adjustments;
  DELETE FROM inventory_reservations;
  DELETE FROM inventory_balances;
  DELETE FROM budget_consumption;
  DELETE FROM revenue_recognition_entries;
  DELETE FROM revenue_recognition_schedules;
  DELETE FROM project_costs;
  DELETE FROM project_revenues;
  DELETE FROM projects;
  DELETE FROM vendor_approvals;
  DELETE FROM vendor_contacts;
  DELETE FROM vendor_documents;
  UPDATE bank_accounts SET current_balance = opening_balance;
END;
$$;

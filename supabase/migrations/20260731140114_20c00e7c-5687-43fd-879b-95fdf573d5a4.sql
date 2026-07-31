CREATE OR REPLACE FUNCTION public.seed_default_email_events(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_org_id IS NULL OR p_org_id <> public.get_user_org_id() THEN
    RAISE EXCEPTION 'Not authorized to seed email events for this organization';
  END IF;

  INSERT INTO public.email_event_settings
    (organization_id, event_key, event_label, module, description, enabled, recipient_roles, extra_emails, template_name)
  SELECT p_org_id, d.event_key, d.event_label, d.module, d.description, d.enabled, '[]'::jsonb, '[]'::jsonb, 'notification'
  FROM (VALUES
    ('credit_note_issued','Credit Note Issued','Finance','Notify vendor/customer when a credit note is issued',false),
    ('invoice_approved','Invoice Approved','Finance','Notify vendor and AP when invoice is approved',false),
    ('invoice_logged','Vendor Invoice Logged','Finance','Notify AP team when a vendor invoice is logged',false),
    ('journal_posted','Journal Entry Posted','Finance','Notify finance manager when a journal is posted',false),
    ('payment_made','Payment Made to Vendor','Finance','Send payment advice to vendor',false),
    ('leave_decided','Leave Approved/Rejected','HR','Notify employee of leave decision',false),
    ('leave_requested','Leave Requested','HR','Notify manager of new leave request',false),
    ('payroll_posted','Payroll Posted','HR','Notify finance when payroll is posted',false),
    ('payslip_ready','Payslip Ready','HR','Notify employee that payslip is available',false),
    ('grn_posted','Goods Receipt Posted','Inventory','Notify requester when goods are received',true),
    ('inventory_issue_posted','Inventory Issue Posted','Inventory','Notify department when items are issued',true),
    ('low_stock_alert','Low Stock Alert','Inventory','Alert warehouse when item hits reorder level',true),
    ('transfer_received','Inventory Transfer Received','Inventory','Notify destination when transfer arrives',true),
    ('bid_received','Vendor Bid Received','Procurement','Notify procurement when a vendor submits a bid',true),
    ('po_acknowledged','PO Acknowledged by Vendor','Procurement','Notify procurement when vendor acknowledges PO',true),
    ('po_approved','Purchase Order Approved','Procurement','Notify requester when PO is approved',true),
    ('po_sent_to_vendor','PO Sent to Vendor','Procurement','Send the PO to the vendor',true),
    ('po_submitted','Purchase Order Submitted for Approval','Procurement','Notify approving officers when a PO is submitted for approval',true),
    ('pr_approved','Purchase Requisition Approved','Procurement','Notify requester when PR is approved',true),
    ('pr_rejected','Purchase Requisition Rejected','Procurement','Notify requester when PR is rejected',true),
    ('pr_submitted','Purchase Requisition Submitted','Procurement','Notify approver when a PR is submitted',true),
    ('rfq_sent','RFQ Sent to Vendor','Procurement','Notify invited vendors of a new RFQ',true),
    ('ar_invoice_sent','AR Invoice Sent','Sales','Send invoice to customer',false),
    ('delivery_dispatched','Delivery Note Dispatched','Sales','Notify customer when goods are dispatched',false),
    ('receipt_recorded','Customer Receipt Recorded','Sales','Send receipt confirmation to customer',false),
    ('sales_order_confirmed','Sales Order Confirmed','Sales','Notify customer when order is confirmed',false)
  ) AS d(event_key, event_label, module, description, enabled)
  ON CONFLICT (organization_id, event_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_email_events(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_email_events(uuid) TO authenticated;
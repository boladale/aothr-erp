
CREATE TABLE IF NOT EXISTS public.email_event_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  event_key TEXT NOT NULL,
  event_label TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  recipient_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_name TEXT NOT NULL DEFAULT 'notification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, event_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_event_settings TO authenticated;
GRANT ALL ON public.email_event_settings TO service_role;

ALTER TABLE public.email_event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email event settings"
  ON public.email_event_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email event settings"
  ON public.email_event_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email event settings"
  ON public.email_event_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email event settings"
  ON public.email_event_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_event_settings_updated_at
  BEFORE UPDATE ON public.email_event_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_event_settings (event_key, event_label, module, description) VALUES
  ('pr_submitted', 'Purchase Requisition Submitted', 'Procurement', 'Notify approver when a PR is submitted'),
  ('pr_approved', 'Purchase Requisition Approved', 'Procurement', 'Notify requester when PR is approved'),
  ('pr_rejected', 'Purchase Requisition Rejected', 'Procurement', 'Notify requester when PR is rejected'),
  ('rfq_sent', 'RFQ Sent to Vendor', 'Procurement', 'Notify invited vendors of a new RFQ'),
  ('bid_received', 'Vendor Bid Received', 'Procurement', 'Notify procurement when a vendor submits a bid'),
  ('po_approved', 'Purchase Order Approved', 'Procurement', 'Notify requester when PO is approved'),
  ('po_sent_to_vendor', 'PO Sent to Vendor', 'Procurement', 'Send the PO to the vendor'),
  ('po_acknowledged', 'PO Acknowledged by Vendor', 'Procurement', 'Notify procurement when vendor acknowledges PO'),
  ('grn_posted', 'Goods Receipt Posted', 'Inventory', 'Notify requester when goods are received'),
  ('low_stock_alert', 'Low Stock Alert', 'Inventory', 'Alert warehouse when item hits reorder level'),
  ('inventory_issue_posted', 'Inventory Issue Posted', 'Inventory', 'Notify department when items are issued'),
  ('transfer_received', 'Inventory Transfer Received', 'Inventory', 'Notify destination when transfer arrives'),
  ('invoice_logged', 'Vendor Invoice Logged', 'Finance', 'Notify AP team when a vendor invoice is logged'),
  ('invoice_approved', 'Invoice Approved', 'Finance', 'Notify vendor and AP when invoice is approved'),
  ('payment_made', 'Payment Made to Vendor', 'Finance', 'Send payment advice to vendor'),
  ('credit_note_issued', 'Credit Note Issued', 'Finance', 'Notify vendor/customer when a credit note is issued'),
  ('journal_posted', 'Journal Entry Posted', 'Finance', 'Notify finance manager when a journal is posted'),
  ('sales_order_confirmed', 'Sales Order Confirmed', 'Sales', 'Notify customer when order is confirmed'),
  ('delivery_dispatched', 'Delivery Note Dispatched', 'Sales', 'Notify customer when goods are dispatched'),
  ('ar_invoice_sent', 'AR Invoice Sent', 'Sales', 'Send invoice to customer'),
  ('receipt_recorded', 'Customer Receipt Recorded', 'Sales', 'Send receipt confirmation to customer'),
  ('leave_requested', 'Leave Requested', 'HR', 'Notify manager of new leave request'),
  ('leave_decided', 'Leave Approved/Rejected', 'HR', 'Notify employee of leave decision'),
  ('payroll_posted', 'Payroll Posted', 'HR', 'Notify finance when payroll is posted'),
  ('payslip_ready', 'Payslip Ready', 'HR', 'Notify employee that payslip is available')
ON CONFLICT (organization_id, event_key) DO NOTHING;

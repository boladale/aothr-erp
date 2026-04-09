
INSERT INTO public.permissions (code, description)
VALUES 
    ('inventory_transfers', 'Manage warehouse-to-warehouse inventory transfers'),
    ('vendor_payment_report', 'View vendor payment tracking report'),
    ('procurement_audit', 'View procurement audit trail'),
    ('req_to_payment_report', 'View requisition to payment lifecycle report')
ON CONFLICT (code) DO NOTHING;

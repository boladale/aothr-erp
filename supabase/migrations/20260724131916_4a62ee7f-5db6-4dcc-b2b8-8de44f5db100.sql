INSERT INTO public.email_event_settings (event_key, event_label, module, description, enabled)
SELECT 'po_submitted', 'Purchase Order Submitted for Approval', 'Procurement', 'Notify approving officers when a PO is submitted for approval', true
WHERE NOT EXISTS (SELECT 1 FROM public.email_event_settings WHERE event_key = 'po_submitted' AND organization_id IS NULL);

INSERT INTO public.email_event_settings (organization_id, event_key, event_label, module, description, enabled)
SELECT DISTINCT organization_id, 'po_submitted', 'Purchase Order Submitted for Approval', 'Procurement', 'Notify approving officers when a PO is submitted for approval', true
FROM public.email_event_settings
WHERE organization_id IS NOT NULL
ON CONFLICT (organization_id, event_key) DO NOTHING;
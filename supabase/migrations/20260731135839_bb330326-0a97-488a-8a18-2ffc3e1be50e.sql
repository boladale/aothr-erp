-- Clone the global (org-less) email event templates into every organization
INSERT INTO public.email_event_settings
  (organization_id, event_key, event_label, module, description, enabled, recipient_roles, extra_emails, template_name)
SELECT o.id, s.event_key, s.event_label, s.module, s.description, s.enabled, s.recipient_roles, s.extra_emails, s.template_name
FROM public.email_event_settings s
CROSS JOIN public.organizations o
WHERE s.organization_id IS NULL
ON CONFLICT (organization_id, event_key) DO NOTHING;

-- Remove the orphaned org-less rows that nobody could see
DELETE FROM public.email_event_settings WHERE organization_id IS NULL;

-- Prevent org-less rows in future
ALTER TABLE public.email_event_settings ALTER COLUMN organization_id SET NOT NULL;
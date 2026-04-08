
INSERT INTO public.permissions (code, description)
VALUES ('workflows', 'Manage workflow configurations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.app_role_permissions (app_role, permission_id)
SELECT 'admin', id FROM public.permissions WHERE code = 'workflows'
ON CONFLICT DO NOTHING;

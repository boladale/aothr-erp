
INSERT INTO public.permissions (id, code, description)
VALUES (gen_random_uuid(), 'vendor_registrations', 'Review and approve/reject vendor registration requests')
ON CONFLICT (code) DO NOTHING;

-- Assign to admin and procurement_manager roles by default
INSERT INTO public.app_role_permissions (app_role, permission_id)
SELECT 'admin', id FROM public.permissions WHERE code = 'vendor_registrations'
ON CONFLICT DO NOTHING;

INSERT INTO public.app_role_permissions (app_role, permission_id)
SELECT 'procurement_manager', id FROM public.permissions WHERE code = 'vendor_registrations'
ON CONFLICT DO NOTHING;

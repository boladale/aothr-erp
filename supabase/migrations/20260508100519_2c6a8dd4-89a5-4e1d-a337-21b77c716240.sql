
-- Link table to attach custom roles (from public.roles) to users
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom roles"
  ON public.user_custom_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage org user custom roles"
  ON public.user_custom_roles
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_custom_roles.user_id
        AND p.organization_id = get_user_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = user_custom_roles.role_id
        AND r.organization_id = get_user_org_id()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_custom_roles.user_id
        AND p.organization_id = get_user_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = user_custom_roles.role_id
        AND r.organization_id = get_user_org_id()
    )
  );

-- Update get_user_programs to also include programs from custom roles
CREATE OR REPLACE FUNCTION public.get_user_programs(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT code), ARRAY[]::text[])
  FROM (
    SELECT p.code
    FROM user_roles ur
    JOIN app_role_permissions arp ON arp.app_role = ur.role
    JOIN permissions p ON p.id = arp.permission_id
    WHERE ur.user_id = p_user_id
    UNION
    SELECT p.code
    FROM user_custom_roles ucr
    JOIN role_permissions rp ON rp.role_id = ucr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ucr.user_id = p_user_id
  ) merged;
$function$;

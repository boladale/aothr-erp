
-- Phase 1: Create organizations table and update profiles

-- 1. Organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    city TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 3. Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 4. Helper function: get current user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 5. RLS policies for organizations
-- Users can see their own organization
CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT
TO authenticated
USING (id = public.get_user_org_id());

-- Admins can update their organization
CREATE POLICY "Admins can update own organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = public.get_user_org_id() AND public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can create an organization (for self-service signup)
CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

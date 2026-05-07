CREATE TABLE public.job_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view job roles"
ON public.job_roles FOR SELECT
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "HR can insert job roles"
ON public.job_roles FOR INSERT
WITH CHECK (
  organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_permission('employees') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "HR can update job roles"
ON public.job_roles FOR UPDATE
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_permission('employees') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "HR can delete job roles"
ON public.job_roles FOR DELETE
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  AND (public.has_permission('employees') OR public.has_role(auth.uid(), 'admin'))
);

CREATE TRIGGER update_job_roles_updated_at
BEFORE UPDATE ON public.job_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create table linking AppRole enum to permissions (programs)
CREATE TABLE IF NOT EXISTS public.app_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_role, permission_id)
);

ALTER TABLE public.app_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view app_role_permissions"
  ON public.app_role_permissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage app_role_permissions"
  ON public.app_role_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add missing programs for newer modules
INSERT INTO public.permissions (code, description) VALUES
  ('chart_of_accounts', 'Manage chart of accounts'),
  ('journal_entries', 'Create and manage journal entries'),
  ('financial_reports', 'View financial reports'),
  ('fiscal_periods', 'Manage fiscal periods'),
  ('ap_payments', 'Process accounts payable payments'),
  ('ap_aging', 'View AP aging reports'),
  ('customers', 'Manage customers'),
  ('ar_invoices', 'Manage AR invoices'),
  ('ar_receipts', 'Process AR receipts'),
  ('ar_credit_notes', 'Manage AR credit notes'),
  ('ar_aging', 'View AR aging reports'),
  ('bank_accounts', 'Manage bank accounts'),
  ('fund_transfers', 'Process fund transfers'),
  ('bank_reconciliation', 'Perform bank reconciliation'),
  ('cash_flow_forecast', 'View cash flow forecasts'),
  ('inventory_valuation', 'View inventory valuation'),
  ('projects', 'Manage projects and project costs'),
  ('project_profitability', 'View project profitability reports'),
  ('user_management', 'Manage users and role assignments')
ON CONFLICT DO NOTHING;

-- Create a security definer function to check program access
CREATE OR REPLACE FUNCTION public.get_user_programs(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.code), ARRAY[]::text[])
  FROM user_roles ur
  JOIN app_role_permissions arp ON arp.app_role = ur.role
  JOIN permissions p ON p.id = arp.permission_id
  WHERE ur.user_id = p_user_id;
$$;
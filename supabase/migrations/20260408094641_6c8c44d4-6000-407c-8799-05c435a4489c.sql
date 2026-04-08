
-- Create workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, organization_id)
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflows"
  ON public.workflows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage workflows"
  ON public.workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create workflow_states table
CREATE TABLE IF NOT EXISTS public.workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  state_name TEXT NOT NULL,
  state_label TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  state_order INT NOT NULL DEFAULT 0,
  is_initial BOOLEAN DEFAULT false,
  is_terminal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow states"
  ON public.workflow_states FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage workflow states"
  ON public.workflow_states FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create workflow_transitions table
CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  from_state_id UUID NOT NULL REFERENCES public.workflow_states(id) ON DELETE CASCADE,
  to_state_id UUID NOT NULL REFERENCES public.workflow_states(id) ON DELETE CASCADE,
  action_label TEXT NOT NULL,
  required_role TEXT,
  requires_approval BOOLEAN DEFAULT false,
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow transitions"
  ON public.workflow_transitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage workflow transitions"
  ON public.workflow_transitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create workflow_auto_actions table
CREATE TABLE IF NOT EXISTS public.workflow_auto_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id UUID NOT NULL REFERENCES public.workflow_transitions(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'on_enter',
  action_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_auto_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow auto actions"
  ON public.workflow_auto_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage workflow auto actions"
  ON public.workflow_auto_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

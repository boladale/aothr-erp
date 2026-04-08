
-- Create data_backups table
CREATE TABLE public.data_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_name TEXT NOT NULL,
  description TEXT,
  tables_included TEXT[] NOT NULL DEFAULT '{}',
  file_url TEXT,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view backups in their org"
  ON public.data_backups FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create backups in their org"
  ON public.data_backups FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete backups in their org"
  ON public.data_backups FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public) VALUES ('data-backups', 'data-backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can upload backups"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'data-backups');

CREATE POLICY "Auth users can read backups"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'data-backups');

CREATE POLICY "Auth users can delete backups"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'data-backups');

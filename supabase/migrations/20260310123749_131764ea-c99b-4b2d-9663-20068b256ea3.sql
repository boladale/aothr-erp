
-- Add app_name column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS app_name text DEFAULT NULL;

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to org-logos bucket
CREATE POLICY "Authenticated users can upload org logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'org-logos');

-- Allow public read access to org logos
CREATE POLICY "Public can view org logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'org-logos');

-- Allow authenticated users to update their org logos
CREATE POLICY "Authenticated users can update org logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'org-logos');

-- Allow authenticated users to delete org logos
CREATE POLICY "Authenticated users can delete org logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'org-logos');

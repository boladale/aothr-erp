
-- 1. RFP items: allow service or item
ALTER TABLE public.rfp_items ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id);
ALTER TABLE public.rfp_items ALTER COLUMN item_id DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rfp_items_item_or_service_chk') THEN
    ALTER TABLE public.rfp_items ADD CONSTRAINT rfp_items_item_or_service_chk
      CHECK (item_id IS NOT NULL OR service_id IS NOT NULL);
  END IF;
END $$;

-- 2. Signature URL on profiles & vendor_users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url text;
ALTER TABLE public.vendor_users ADD COLUMN IF NOT EXISTS signature_url text;

-- 3. PO signature/acceptance fields
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS acceptance_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS vendor_signature_url text,
  ADD COLUMN IF NOT EXISTS vendor_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_signed_by uuid,
  ADD COLUMN IF NOT EXISTS vendor_rejection_reason text,
  ADD COLUMN IF NOT EXISTS manager_signature_url text,
  ADD COLUMN IF NOT EXISTS manager_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_signed_by uuid;

-- 4. Signatures storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Signatures are publicly viewable') THEN
    CREATE POLICY "Signatures are publicly viewable" ON storage.objects
      FOR SELECT USING (bucket_id = 'signatures');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload signatures') THEN
    CREATE POLICY "Authenticated users can upload signatures" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own signature files') THEN
    CREATE POLICY "Users can update their own signature files" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own signature files') THEN
    CREATE POLICY "Users can delete their own signature files" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

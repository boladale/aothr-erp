
-- Signed docs are stored under: <organization_id>/<signature_request_id>.pdf
CREATE POLICY "org members can read signed documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-documents'
    AND (storage.foldername(name))[1] = (
      SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
    )
  );

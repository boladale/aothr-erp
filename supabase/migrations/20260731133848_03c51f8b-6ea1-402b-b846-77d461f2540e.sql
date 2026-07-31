ALTER TABLE public.email_send_log ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_email_send_log_org ON public.email_send_log (organization_id, created_at DESC);

-- Backfill from metadata when previously recorded there
UPDATE public.email_send_log
SET organization_id = (metadata->>'organization_id')::uuid
WHERE organization_id IS NULL
  AND metadata ? 'organization_id'
  AND (metadata->>'organization_id') ~ '^[0-9a-fA-F-]{36}$';

DROP POLICY IF EXISTS "Admins can read email send log" ON public.email_send_log;

CREATE POLICY "Admins can read own org email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id IS NOT NULL
  AND organization_id = public.get_user_org_id()
);
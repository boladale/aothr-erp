ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal';
CREATE INDEX IF NOT EXISTS idx_ap_invoices_source ON public.ap_invoices(source, status);
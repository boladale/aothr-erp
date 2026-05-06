
-- 1. Add 'cancelled' to po_status enum if missing
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add rfp_id link on purchase_orders for traceability (so we know which RFP a PO came from)
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS rfp_id uuid REFERENCES public.rfps(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_rfp ON public.purchase_orders(rfp_id);

-- 3. Mandatory rejection reason on vendor_po_acknowledgments
ALTER TABLE public.vendor_po_acknowledgments
  DROP CONSTRAINT IF EXISTS vendor_po_acks_reject_reason_chk;
ALTER TABLE public.vendor_po_acknowledgments
  ADD CONSTRAINT vendor_po_acks_reject_reason_chk
  CHECK (action <> 'rejected' OR (notes IS NOT NULL AND length(btrim(notes)) >= 10));

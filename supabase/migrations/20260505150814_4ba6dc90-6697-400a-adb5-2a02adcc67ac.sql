ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id);
ALTER TABLE public.purchase_order_lines ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.purchase_order_lines ADD CONSTRAINT po_line_item_or_service_chk CHECK (item_id IS NOT NULL OR service_id IS NOT NULL);
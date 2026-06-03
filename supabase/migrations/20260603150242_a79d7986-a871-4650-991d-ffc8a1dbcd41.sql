ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS reorder_level numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_serial_number ON public.items(serial_number);

-- Add rejection_reason column to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add rejection_reason column to ap_invoices
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add rejection_reason column to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS rejection_reason text;

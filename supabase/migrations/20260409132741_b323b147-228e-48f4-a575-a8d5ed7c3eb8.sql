
ALTER TABLE public.purchase_orders
ADD COLUMN discount_type text NOT NULL DEFAULT 'percentage',
ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;

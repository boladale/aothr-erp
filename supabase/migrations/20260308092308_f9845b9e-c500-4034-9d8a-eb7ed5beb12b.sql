
-- =============================================
-- TAX CONFIGURATION ENGINE
-- =============================================
CREATE TABLE public.tax_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_group_id UUID NOT NULL REFERENCES public.tax_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate_pct NUMERIC NOT NULL DEFAULT 0,
    gl_account_id UUID REFERENCES public.gl_accounts(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which tax group applies to which item category
CREATE TABLE public.item_tax_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_category TEXT NOT NULL,
    tax_group_id UUID NOT NULL REFERENCES public.tax_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(item_category)
);

-- =============================================
-- DOCUMENT ATTACHMENTS (universal)
-- =============================================
CREATE TABLE public.transaction_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    content_type TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_entity ON public.transaction_attachments(entity_type, entity_id);

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SALES ORDER CYCLE
-- =============================================

-- Sales Quotation statuses
CREATE TYPE public.quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

CREATE TABLE public.sales_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    status quotation_status NOT NULL DEFAULT 'draft',
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    tax_group_id UUID REFERENCES public.tax_groups(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_id UUID REFERENCES public.items(id),
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Sales Order statuses
CREATE TYPE public.sales_order_status AS ENUM ('draft', 'confirmed', 'partially_delivered', 'fully_delivered', 'closed', 'cancelled');

CREATE TABLE public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    quotation_id UUID REFERENCES public.sales_quotations(id),
    status sales_order_status NOT NULL DEFAULT 'draft',
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    tax_group_id UUID REFERENCES public.tax_groups(id),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    item_id UUID REFERENCES public.items(id),
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    line_total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    qty_delivered NUMERIC NOT NULL DEFAULT 0,
    qty_invoiced NUMERIC NOT NULL DEFAULT 0
);

-- Delivery Notes
CREATE TYPE public.delivery_status AS ENUM ('draft', 'posted');

CREATE TABLE public.delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dn_number TEXT NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES public.sales_orders(id),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    location_id UUID REFERENCES public.locations(id),
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status delivery_status NOT NULL DEFAULT 'draft',
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.delivery_note_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dn_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
    order_line_id UUID NOT NULL REFERENCES public.sales_order_lines(id),
    item_id UUID REFERENCES public.items(id),
    qty_delivered NUMERIC NOT NULL
);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.tax_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_tax_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_lines ENABLE ROW LEVEL SECURITY;

-- Tax: everyone reads, admin manages
CREATE POLICY "Auth users can view tax_groups" ON public.tax_groups FOR SELECT USING (true);
CREATE POLICY "Admin can manage tax_groups" ON public.tax_groups FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users can view tax_rates" ON public.tax_rates FOR SELECT USING (true);
CREATE POLICY "Admin can manage tax_rates" ON public.tax_rates FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users can view item_tax_mappings" ON public.item_tax_mappings FOR SELECT USING (true);
CREATE POLICY "Admin can manage item_tax_mappings" ON public.item_tax_mappings FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Attachments: authenticated users can view and upload
CREATE POLICY "Auth users can view attachments" ON public.transaction_attachments FOR SELECT USING (true);
CREATE POLICY "Auth users can upload attachments" ON public.transaction_attachments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Uploader or admin can delete attachments" ON public.transaction_attachments FOR DELETE USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Storage bucket policies
CREATE POLICY "Auth users can upload to transaction-attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can view transaction-attachments" ON storage.objects FOR SELECT USING (bucket_id = 'transaction-attachments');
CREATE POLICY "Uploader can delete from transaction-attachments" ON storage.objects FOR DELETE USING (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);

-- Sales: finance/admin manage, all authenticated view
CREATE POLICY "Auth users can view sales_quotations" ON public.sales_quotations FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage quotations" ON public.sales_quotations FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

CREATE POLICY "Auth users can view sales_quotation_lines" ON public.sales_quotation_lines FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage quotation_lines" ON public.sales_quotation_lines FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

CREATE POLICY "Auth users can view sales_orders" ON public.sales_orders FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage orders" ON public.sales_orders FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

CREATE POLICY "Auth users can view sales_order_lines" ON public.sales_order_lines FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage order_lines" ON public.sales_order_lines FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

CREATE POLICY "Auth users can view delivery_notes" ON public.delivery_notes FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage delivery_notes" ON public.delivery_notes FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

CREATE POLICY "Auth users can view delivery_note_lines" ON public.delivery_note_lines FOR SELECT USING (true);
CREATE POLICY "Sales and admin can manage dn_lines" ON public.delivery_note_lines FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer'));

-- =============================================
-- TRIGGERS: Delivery Note posting updates SO
-- =============================================
CREATE OR REPLACE FUNCTION public.update_so_line_qty_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        -- Update qty_delivered on SO lines
        UPDATE sales_order_lines sol
        SET qty_delivered = COALESCE(qty_delivered, 0) + dnl.qty_delivered
        FROM delivery_note_lines dnl
        WHERE dnl.dn_id = NEW.id AND sol.id = dnl.order_line_id;
        
        -- Update SO status
        UPDATE sales_orders so
        SET status = CASE
            WHEN (SELECT COUNT(*) FROM sales_order_lines WHERE order_id = so.id AND qty_delivered < quantity) = 0
            THEN 'fully_delivered'::sales_order_status
            ELSE 'partially_delivered'::sales_order_status
        END
        WHERE so.id = NEW.order_id AND so.status IN ('confirmed', 'partially_delivered');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_note_post
BEFORE UPDATE ON public.delivery_notes
FOR EACH ROW EXECUTE FUNCTION update_so_line_qty_delivered();

-- Prevent unposting delivery notes
CREATE OR REPLACE FUNCTION public.prevent_dn_unpost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot un-post a delivery note';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_dn_unpost
BEFORE UPDATE ON public.delivery_notes
FOR EACH ROW EXECUTE FUNCTION prevent_dn_unpost();

-- Updated_at triggers
CREATE TRIGGER trg_tax_groups_updated_at BEFORE UPDATE ON public.tax_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sales_quotations_updated_at BEFORE UPDATE ON public.sales_quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default tax groups
INSERT INTO public.tax_groups (name, description, is_default) VALUES
  ('Standard Rate', 'Standard VAT/GST rate', true),
  ('Reduced Rate', 'Reduced rate for essential goods', false),
  ('Zero Rate', 'Zero-rated / tax exempt', false);

INSERT INTO public.tax_rates (tax_group_id, name, rate_pct, gl_account_id) VALUES
  ((SELECT id FROM tax_groups WHERE name = 'Standard Rate'), 'VAT 7.5%', 7.5, (SELECT id FROM gl_accounts WHERE account_code = '2300')),
  ((SELECT id FROM tax_groups WHERE name = 'Reduced Rate'), 'VAT 5%', 5.0, (SELECT id FROM gl_accounts WHERE account_code = '2300')),
  ((SELECT id FROM tax_groups WHERE name = 'Zero Rate'), 'Exempt', 0, NULL);

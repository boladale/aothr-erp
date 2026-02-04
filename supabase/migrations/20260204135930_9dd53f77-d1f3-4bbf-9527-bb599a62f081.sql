-- =====================================================
-- PHASE 1: Business Operations System - Data Model
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE public.vendor_status AS ENUM ('draft', 'pending_approval', 'active', 'inactive');
CREATE TYPE public.po_status AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'fully_received', 'closed');
CREATE TYPE public.adjustment_type AS ENUM ('increase', 'decrease');
CREATE TYPE public.app_role AS ENUM ('admin', 'procurement_manager', 'warehouse_manager', 'accounts_payable', 'viewer');

-- =====================================================
-- RBAC TABLES
-- =====================================================

-- Permissions table
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Roles table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Role-Permissions junction
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(role_id, permission_id)
);

-- User Roles junction (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, role)
);

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Audit logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- VENDOR TABLES
-- =====================================================

CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status vendor_status DEFAULT 'draft' NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    payment_terms INTEGER DEFAULT 30,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.vendor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.vendor_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- ITEMS & INVENTORY TABLES
-- =====================================================

CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit_of_measure TEXT DEFAULT 'EA' NOT NULL,
    unit_cost DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    quantity DECIMAL(15,4) DEFAULT 0 NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(item_id, location_id),
    CONSTRAINT positive_inventory CHECK (quantity >= 0)
);

CREATE TABLE public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number TEXT UNIQUE NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    adjustment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'draft' NOT NULL,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.inventory_adjustment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    adjustment_type adjustment_type NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    notes TEXT,
    CONSTRAINT positive_qty CHECK (quantity > 0)
);

-- =====================================================
-- PURCHASE ORDER TABLES
-- =====================================================

CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number TEXT UNIQUE NOT NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE RESTRICT NOT NULL,
    status po_status DEFAULT 'draft' NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE NOT NULL,
    expected_date DATE,
    ship_to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    close_ready BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    line_number INTEGER NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    description TEXT,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    qty_received DECIMAL(15,4) DEFAULT 0,
    qty_invoiced DECIMAL(15,4) DEFAULT 0,
    CONSTRAINT positive_qty CHECK (quantity > 0),
    UNIQUE(po_id, line_number)
);

CREATE TABLE public.po_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- GOODS RECEIPT TABLES
-- =====================================================

CREATE TABLE public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number TEXT UNIQUE NOT NULL,
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT NOT NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT NOT NULL,
    receipt_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    notes TEXT,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.goods_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID REFERENCES public.goods_receipts(id) ON DELETE CASCADE NOT NULL,
    po_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE RESTRICT NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    qty_received DECIMAL(15,4) NOT NULL,
    CONSTRAINT positive_qty CHECK (qty_received > 0)
);

-- =====================================================
-- INVOICE TABLES (Minimal)
-- =====================================================

CREATE TABLE public.ap_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE RESTRICT NOT NULL,
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE RESTRICT NOT NULL,
    invoice_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' NOT NULL,
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(vendor_id, invoice_number)
);

CREATE TABLE public.ap_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.ap_invoices(id) ON DELETE CASCADE NOT NULL,
    po_line_id UUID REFERENCES public.purchase_order_lines(id) ON DELETE RESTRICT NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    CONSTRAINT positive_qty CHECK (quantity > 0)
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, entity_type, entity_id, notification_type)
);

-- =====================================================
-- SECURITY DEFINER FUNCTIONS FOR RBAC
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(role), ARRAY[]::app_role[])
    FROM public.user_roles
    WHERE user_id = _user_id
$$;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    -- Assign default role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Audit logs policies (admins only)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Business data policies (authenticated users)
CREATE POLICY "Auth users can view vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage vendors" ON public.vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view vendor_contacts" ON public.vendor_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage vendor_contacts" ON public.vendor_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view vendor_approvals" ON public.vendor_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage vendor_approvals" ON public.vendor_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage items" ON public.items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage locations" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view inventory_balances" ON public.inventory_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage inventory_balances" ON public.inventory_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view inventory_adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage inventory_adjustments" ON public.inventory_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view inventory_adjustment_lines" ON public.inventory_adjustment_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage inventory_adjustment_lines" ON public.inventory_adjustment_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view purchase_order_lines" ON public.purchase_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage purchase_order_lines" ON public.purchase_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view po_approvals" ON public.po_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage po_approvals" ON public.po_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view goods_receipts" ON public.goods_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage goods_receipts" ON public.goods_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view goods_receipt_lines" ON public.goods_receipt_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage goods_receipt_lines" ON public.goods_receipt_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view ap_invoices" ON public.ap_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage ap_invoices" ON public.ap_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view ap_invoice_lines" ON public.ap_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage ap_invoice_lines" ON public.ap_invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth users can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can view role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_vendors_status ON public.vendors(status);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_close_ready ON public.purchase_orders(close_ready);
CREATE INDEX idx_goods_receipts_po ON public.goods_receipts(po_id);
CREATE INDEX idx_ap_invoices_po ON public.ap_invoices(po_id);
CREATE INDEX idx_inventory_balances_item ON public.inventory_balances(item_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
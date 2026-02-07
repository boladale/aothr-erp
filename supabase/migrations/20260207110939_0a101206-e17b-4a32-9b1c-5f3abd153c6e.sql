
-- Fix remaining permissive RLS policies

-- Items: All authenticated can view, only procurement/admin can manage
DROP POLICY IF EXISTS "Auth users can manage items" ON public.items;
CREATE POLICY "Procurement and admin can manage items"
ON public.items FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
);

-- Locations: Similar to items
DROP POLICY IF EXISTS "Auth users can manage locations" ON public.locations;
CREATE POLICY "Procurement and admin can manage locations"
ON public.locations FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
);

-- Inventory balances: Warehouse manager, procurement, admin
DROP POLICY IF EXISTS "Auth users can manage inventory_balances" ON public.inventory_balances;
CREATE POLICY "Warehouse and admin can manage inventory_balances"
ON public.inventory_balances FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'warehouse_manager')
);

-- Inventory adjustments: Warehouse manager, admin
DROP POLICY IF EXISTS "Auth users can manage inventory_adjustments" ON public.inventory_adjustments;
CREATE POLICY "Warehouse and admin can manage adjustments"
ON public.inventory_adjustments FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'warehouse_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'warehouse_manager')
);

DROP POLICY IF EXISTS "Auth users can manage inventory_adjustment_lines" ON public.inventory_adjustment_lines;
CREATE POLICY "Warehouse and admin can manage adjustment_lines"
ON public.inventory_adjustment_lines FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'warehouse_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'warehouse_manager')
);

-- Purchase order lines: Same as POs
DROP POLICY IF EXISTS "Auth users can manage purchase_order_lines" ON public.purchase_order_lines;
CREATE POLICY "Procurement and admin can manage PO lines"
ON public.purchase_order_lines FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- Vendor contacts: Same as vendors
DROP POLICY IF EXISTS "Auth users can manage vendor_contacts" ON public.vendor_contacts;
CREATE POLICY "Procurement and admin can manage vendor_contacts"
ON public.vendor_contacts FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- Vendor documents: Same as vendors
DROP POLICY IF EXISTS "Auth users can manage vendor_documents" ON public.vendor_documents;
CREATE POLICY "Procurement and admin can manage vendor_documents"
ON public.vendor_documents FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

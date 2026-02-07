
-- =====================================================
-- PHASE 1: WORKFLOW ENFORCEMENT TRIGGERS
-- =====================================================

-- 1. Prevent vendor edits after submission (pending_approval or active status)
CREATE OR REPLACE FUNCTION public.enforce_vendor_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow status changes by approvers, but block other field changes
    IF OLD.status IN ('pending_approval', 'active') THEN
        -- Only allow status field changes
        IF NEW.name IS DISTINCT FROM OLD.name OR
           NEW.code IS DISTINCT FROM OLD.code OR
           NEW.email IS DISTINCT FROM OLD.email OR
           NEW.phone IS DISTINCT FROM OLD.phone OR
           NEW.address IS DISTINCT FROM OLD.address OR
           NEW.city IS DISTINCT FROM OLD.city OR
           NEW.country IS DISTINCT FROM OLD.country OR
           NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
           NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
           NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number OR
           NEW.service_categories IS DISTINCT FROM OLD.service_categories OR
           NEW.project_size_capacity IS DISTINCT FROM OLD.project_size_capacity THEN
            RAISE EXCEPTION 'Vendor cannot be modified after submission. Current status: %', OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_vendor_lock_trigger
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vendor_lock();

-- 2. Prevent PO edits after submission
CREATE OR REPLACE FUNCTION public.enforce_po_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status NOT IN ('draft') THEN
        -- Only allow specific status transitions and related fields
        IF NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR
           NEW.ship_to_location_id IS DISTINCT FROM OLD.ship_to_location_id OR
           NEW.expected_date IS DISTINCT FROM OLD.expected_date OR
           NEW.notes IS DISTINCT FROM OLD.notes OR
           NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
           NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
           NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
            RAISE EXCEPTION 'Purchase Order cannot be modified after submission. Current status: %', OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_po_lock_trigger
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_po_lock();

-- 3. Prevent PO line edits after PO submission
CREATE OR REPLACE FUNCTION public.enforce_po_line_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    po_status po_status;
BEGIN
    SELECT status INTO po_status FROM public.purchase_orders WHERE id = COALESCE(NEW.po_id, OLD.po_id);
    
    IF po_status NOT IN ('draft') THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Cannot delete PO lines after PO submission. PO status: %', po_status;
        ELSIF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Cannot add PO lines after PO submission. PO status: %', po_status;
        ELSIF NEW.item_id IS DISTINCT FROM OLD.item_id OR
              NEW.quantity IS DISTINCT FROM OLD.quantity OR
              NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
            RAISE EXCEPTION 'Cannot modify PO lines after PO submission. PO status: %', po_status;
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_po_line_lock_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_order_lines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_po_line_lock();

-- 4. Enforce PO closure only when close_ready = TRUE
CREATE OR REPLACE FUNCTION public.enforce_po_closure_readiness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        IF NOT COALESCE(OLD.close_ready, false) THEN
            RAISE EXCEPTION 'Cannot close PO: Not all items are fully received and invoiced';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_po_closure_readiness_trigger
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_po_closure_readiness();

-- =====================================================
-- PHASE 2: INVENTORY INTEGRITY
-- =====================================================

-- 5. Block over-receipt (with row-level locking for concurrency)
CREATE OR REPLACE FUNCTION public.enforce_no_over_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    po_line RECORD;
    total_received numeric;
    grn_status text;
BEGIN
    -- Get GRN status
    SELECT status INTO grn_status FROM public.goods_receipts WHERE id = NEW.grn_id;
    
    -- Lock the PO line row to prevent concurrent updates
    SELECT * INTO po_line 
    FROM public.purchase_order_lines 
    WHERE id = NEW.po_line_id
    FOR UPDATE;
    
    -- Calculate total received including this receipt
    SELECT COALESCE(SUM(grl.qty_received), 0) INTO total_received
    FROM public.goods_receipt_lines grl
    JOIN public.goods_receipts gr ON gr.id = grl.grn_id
    WHERE grl.po_line_id = NEW.po_line_id
    AND gr.status = 'posted'
    AND grl.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Add current receipt if GRN is being posted
    IF grn_status = 'posted' OR TG_OP = 'INSERT' THEN
        total_received := total_received + NEW.qty_received;
    END IF;
    
    IF total_received > po_line.quantity THEN
        RAISE EXCEPTION 'Over-receipt not allowed. Ordered: %, Already received: %, Attempting to receive: %', 
            po_line.quantity, 
            total_received - NEW.qty_received, 
            NEW.qty_received;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_no_over_receipt_trigger
BEFORE INSERT OR UPDATE ON public.goods_receipt_lines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_no_over_receipt();

-- 6. Block over-invoicing
CREATE OR REPLACE FUNCTION public.enforce_no_over_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    po_line RECORD;
    total_invoiced numeric;
    invoice_status text;
BEGIN
    SELECT status INTO invoice_status FROM public.ap_invoices WHERE id = NEW.invoice_id;
    
    SELECT * INTO po_line 
    FROM public.purchase_order_lines 
    WHERE id = NEW.po_line_id
    FOR UPDATE;
    
    SELECT COALESCE(SUM(ail.quantity), 0) INTO total_invoiced
    FROM public.ap_invoice_lines ail
    JOIN public.ap_invoices ai ON ai.id = ail.invoice_id
    WHERE ail.po_line_id = NEW.po_line_id
    AND ai.status = 'posted'
    AND ail.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF invoice_status = 'posted' OR TG_OP = 'INSERT' THEN
        total_invoiced := total_invoiced + NEW.quantity;
    END IF;
    
    IF total_invoiced > po_line.quantity THEN
        RAISE EXCEPTION 'Over-invoicing not allowed. Ordered: %, Already invoiced: %, Attempting to invoice: %', 
            po_line.quantity, 
            total_invoiced - NEW.quantity, 
            NEW.quantity;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_no_over_invoice_trigger
BEFORE INSERT OR UPDATE ON public.ap_invoice_lines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_no_over_invoice();

-- 7. Block double GRN/Invoice posting
CREATE OR REPLACE FUNCTION public.prevent_double_post_grn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
        -- Already posted, no change needed
        RETURN NEW;
    END IF;
    
    IF OLD.status = 'posted' AND NEW.status != 'posted' THEN
        RAISE EXCEPTION 'Cannot un-post a goods receipt. GRN: %', OLD.grn_number;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_double_post_grn_trigger
BEFORE UPDATE ON public.goods_receipts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_double_post_grn();

CREATE OR REPLACE FUNCTION public.prevent_double_post_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status != 'posted' THEN
        RAISE EXCEPTION 'Cannot un-post an invoice. Invoice: %', OLD.invoice_number;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_double_post_invoice_trigger
BEFORE UPDATE ON public.ap_invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_double_post_invoice();

-- =====================================================
-- PHASE 3: UPDATE PO LINE QUANTITIES ON POST
-- =====================================================

-- 8. Update qty_received on GRN post
CREATE OR REPLACE FUNCTION public.update_po_line_qty_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Update qty_received for all lines in this GRN
        UPDATE public.purchase_order_lines pol
        SET qty_received = COALESCE(qty_received, 0) + grl.qty_received
        FROM public.goods_receipt_lines grl
        WHERE grl.grn_id = NEW.id
        AND pol.id = grl.po_line_id;
        
        -- Update PO status based on receipt
        UPDATE public.purchase_orders po
        SET status = CASE
            WHEN (SELECT COUNT(*) FROM public.purchase_order_lines WHERE po_id = po.id AND qty_received < quantity) = 0 
            THEN 'fully_received'::po_status
            ELSE 'partially_received'::po_status
        END
        WHERE po.id = NEW.po_id
        AND po.status IN ('sent', 'partially_received');
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_po_line_qty_received_trigger
AFTER UPDATE ON public.goods_receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_po_line_qty_received();

-- 9. Update qty_invoiced on invoice post
CREATE OR REPLACE FUNCTION public.update_po_line_qty_invoiced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        UPDATE public.purchase_order_lines pol
        SET qty_invoiced = COALESCE(qty_invoiced, 0) + ail.quantity
        FROM public.ap_invoice_lines ail
        WHERE ail.invoice_id = NEW.id
        AND pol.id = ail.po_line_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_po_line_qty_invoiced_trigger
AFTER UPDATE ON public.ap_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_po_line_qty_invoiced();

-- 10. Update close_ready flag
CREATE OR REPLACE FUNCTION public.update_po_close_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_po_id uuid;
    all_complete boolean;
BEGIN
    -- Determine which PO to check
    IF TG_TABLE_NAME = 'purchase_order_lines' THEN
        target_po_id := NEW.po_id;
    ELSIF TG_TABLE_NAME = 'goods_receipts' THEN
        target_po_id := NEW.po_id;
    ELSIF TG_TABLE_NAME = 'ap_invoices' THEN
        target_po_id := NEW.po_id;
    END IF;
    
    -- Check if all lines are fully received and invoiced
    SELECT NOT EXISTS (
        SELECT 1 FROM public.purchase_order_lines
        WHERE po_id = target_po_id
        AND (COALESCE(qty_received, 0) < quantity OR COALESCE(qty_invoiced, 0) < quantity)
    ) INTO all_complete;
    
    -- Update the close_ready flag
    UPDATE public.purchase_orders
    SET close_ready = all_complete
    WHERE id = target_po_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_po_close_ready_on_line_change
AFTER UPDATE ON public.purchase_order_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_po_close_ready();

-- =====================================================
-- PHASE 4: UPDATE RLS POLICIES FOR RBAC
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Auth users can manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Auth users can manage purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Auth users can manage po_approvals" ON public.po_approvals;
DROP POLICY IF EXISTS "Auth users can manage vendor_approvals" ON public.vendor_approvals;
DROP POLICY IF EXISTS "Auth users can manage goods_receipts" ON public.goods_receipts;
DROP POLICY IF EXISTS "Auth users can manage goods_receipt_lines" ON public.goods_receipt_lines;
DROP POLICY IF EXISTS "Auth users can manage ap_invoices" ON public.ap_invoices;
DROP POLICY IF EXISTS "Auth users can manage ap_invoice_lines" ON public.ap_invoice_lines;

-- Vendors: Only procurement_manager and admin can create/update
CREATE POLICY "Procurement and admin can manage vendors"
ON public.vendors FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- Purchase Orders: Procurement can create, admin/procurement_manager can approve
CREATE POLICY "Procurement and admin can manage POs"
ON public.purchase_orders FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- PO Approvals: Only admin and procurement_manager can approve
CREATE POLICY "Approvers can manage po_approvals"
ON public.po_approvals FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- Vendor Approvals: Only admin and procurement_manager can approve
CREATE POLICY "Approvers can manage vendor_approvals"
ON public.vendor_approvals FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager')
);

-- Goods Receipts: Warehouse manager, procurement, and admin
CREATE POLICY "Warehouse and procurement can manage GRNs"
ON public.goods_receipts FOR ALL
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

CREATE POLICY "Warehouse and procurement can manage GRN lines"
ON public.goods_receipt_lines FOR ALL
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

-- Invoices: Accounts payable, procurement, and admin
CREATE POLICY "AP and procurement can manage invoices"
ON public.ap_invoices FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'accounts_payable')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'accounts_payable')
);

CREATE POLICY "AP and procurement can manage invoice lines"
ON public.ap_invoice_lines FOR ALL
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'accounts_payable')
)
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'procurement_manager') OR
    has_role(auth.uid(), 'accounts_payable')
);

-- =====================================================
-- PHASE 5: DUPLICATE INVOICE CHECK (already unique constraint exists)
-- Add unique constraint if not exists
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_invoice_per_vendor'
    ) THEN
        ALTER TABLE public.ap_invoices
        ADD CONSTRAINT unique_invoice_per_vendor UNIQUE (vendor_id, invoice_number);
    END IF;
END $$;

-- =====================================================
-- PHASE 6: NOTIFICATION DEDUPLICATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_po_ready_for_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    po_record RECORD;
    notification_exists boolean;
BEGIN
    IF NEW.close_ready = true AND (OLD.close_ready IS NULL OR OLD.close_ready = false) THEN
        SELECT * INTO po_record FROM public.purchase_orders WHERE id = NEW.id;
        
        -- Check if notification already exists
        SELECT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE entity_type = 'purchase_orders'
            AND entity_id = NEW.id
            AND notification_type = 'po_ready_to_close'
        ) INTO notification_exists;
        
        IF NOT notification_exists AND po_record.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id, entity_type, entity_id, notification_type, title, message
            ) VALUES (
                po_record.created_by,
                'purchase_orders',
                NEW.id,
                'po_ready_to_close',
                'PO Ready to Close',
                'Purchase Order ' || po_record.po_number || ' is ready for closure.'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER notify_po_ready_for_closure_trigger
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_po_ready_for_closure();

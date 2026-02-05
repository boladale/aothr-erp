-- Create a generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _action text;
    _actor_id uuid;
BEGIN
    -- Get current user
    _actor_id := auth.uid();
    
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        _action := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        _action := 'updated';
    ELSIF TG_OP = 'DELETE' THEN
        _action := 'deleted';
    END IF;
    
    -- Insert audit log
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (TG_TABLE_NAME, OLD.id, _action, _actor_id, to_jsonb(OLD), NULL);
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (TG_TABLE_NAME, NEW.id, _action, _actor_id, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSE
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (TG_TABLE_NAME, NEW.id, _action, _actor_id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$;

-- Vendor status change audit trigger
CREATE OR REPLACE FUNCTION public.audit_vendor_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'vendors',
            NEW.id,
            'status_changed',
            auth.uid(),
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_vendor_status
AFTER UPDATE ON public.vendors
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.audit_vendor_status_change();

-- PO status change audit trigger
CREATE OR REPLACE FUNCTION public.audit_po_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'purchase_orders',
            NEW.id,
            'status_changed',
            auth.uid(),
            jsonb_build_object('status', OLD.status::text, 'po_number', OLD.po_number),
            jsonb_build_object('status', NEW.status::text, 'po_number', NEW.po_number)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_po_status
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.audit_po_status_change();

-- Inventory balance change audit trigger
CREATE OR REPLACE FUNCTION public.audit_inventory_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'inventory_balances',
            NEW.id,
            'created',
            auth.uid(),
            NULL,
            jsonb_build_object('item_id', NEW.item_id, 'location_id', NEW.location_id, 'quantity', NEW.quantity)
        );
    ELSIF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'inventory_balances',
            NEW.id,
            'quantity_changed',
            auth.uid(),
            jsonb_build_object('quantity', OLD.quantity),
            jsonb_build_object('quantity', NEW.quantity, 'change', NEW.quantity - OLD.quantity)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_inventory_balance
AFTER INSERT OR UPDATE ON public.inventory_balances
FOR EACH ROW
EXECUTE FUNCTION public.audit_inventory_change();

-- Inventory adjustment posted audit trigger
CREATE OR REPLACE FUNCTION public.audit_adjustment_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'inventory_adjustments',
            NEW.id,
            'posted',
            auth.uid(),
            jsonb_build_object('adjustment_number', NEW.adjustment_number),
            jsonb_build_object('adjustment_number', NEW.adjustment_number, 'posted_at', NEW.posted_at)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_adjustment_posted
AFTER UPDATE ON public.inventory_adjustments
FOR EACH ROW
WHEN (OLD.status = 'draft' AND NEW.status = 'posted')
EXECUTE FUNCTION public.audit_adjustment_posted();

-- GRN posted audit trigger
CREATE OR REPLACE FUNCTION public.audit_grn_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'goods_receipts',
            NEW.id,
            'posted',
            auth.uid(),
            jsonb_build_object('grn_number', NEW.grn_number, 'po_id', NEW.po_id),
            jsonb_build_object('grn_number', NEW.grn_number, 'po_id', NEW.po_id, 'posted_at', NEW.posted_at)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_grn_posted
AFTER UPDATE ON public.goods_receipts
FOR EACH ROW
WHEN (OLD.status = 'draft' AND NEW.status = 'posted')
EXECUTE FUNCTION public.audit_grn_posted();

-- Invoice posted audit trigger
CREATE OR REPLACE FUNCTION public.audit_invoice_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
        VALUES (
            'ap_invoices',
            NEW.id,
            'posted',
            auth.uid(),
            jsonb_build_object('invoice_number', NEW.invoice_number, 'total_amount', NEW.total_amount),
            jsonb_build_object('invoice_number', NEW.invoice_number, 'total_amount', NEW.total_amount, 'posted_at', NEW.posted_at)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_invoice_posted
AFTER UPDATE ON public.ap_invoices
FOR EACH ROW
WHEN (OLD.status = 'draft' AND NEW.status = 'posted')
EXECUTE FUNCTION public.audit_invoice_posted();

-- Vendor approval audit trigger (on vendor_approvals insert)
CREATE OR REPLACE FUNCTION public.audit_vendor_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _action text;
BEGIN
    IF NEW.approved_at IS NOT NULL THEN
        _action := 'approved';
    ELSIF NEW.rejected_at IS NOT NULL THEN
        _action := 'rejected';
    ELSE
        _action := 'submitted';
    END IF;
    
    INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
    VALUES (
        'vendor_approvals',
        NEW.id,
        _action,
        NEW.approved_by,
        NULL,
        jsonb_build_object('vendor_id', NEW.vendor_id, 'approved_by', NEW.approved_by)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_vendor_approval
AFTER INSERT ON public.vendor_approvals
FOR EACH ROW
EXECUTE FUNCTION public.audit_vendor_approval();

-- PO approval audit trigger
CREATE OR REPLACE FUNCTION public.audit_po_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _action text;
BEGIN
    IF NEW.approved_at IS NOT NULL THEN
        _action := 'approved';
    ELSIF NEW.rejected_at IS NOT NULL THEN
        _action := 'rejected';
    ELSE
        _action := 'submitted';
    END IF;
    
    INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data)
    VALUES (
        'po_approvals',
        NEW.id,
        _action,
        NEW.approved_by,
        NULL,
        jsonb_build_object('po_id', NEW.po_id, 'approved_by', NEW.approved_by, 'comments', NEW.comments)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_po_approval
AFTER INSERT ON public.po_approvals
FOR EACH ROW
EXECUTE FUNCTION public.audit_po_approval();
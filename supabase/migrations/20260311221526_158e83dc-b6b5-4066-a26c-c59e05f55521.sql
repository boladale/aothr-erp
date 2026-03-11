
-- Fix check_invoice_holds_before_post to also allow from 'approved'
CREATE OR REPLACE FUNCTION public.check_invoice_holds_before_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_unresolved_count INTEGER;
BEGIN
    IF NEW.status = 'posted' AND OLD.status IN ('draft', 'approved') THEN
        SELECT COUNT(*) INTO v_unresolved_count
        FROM invoice_holds
        WHERE invoice_id = NEW.id AND resolved_at IS NULL;
        
        IF v_unresolved_count > 0 THEN
            RAISE EXCEPTION 'Cannot post invoice: % unresolved hold(s) exist', v_unresolved_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Fix update_po_line_qty_invoiced to also allow from 'approved'
CREATE OR REPLACE FUNCTION public.update_po_line_qty_invoiced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status IN ('draft', 'approved') THEN
        UPDATE public.purchase_order_lines pol
        SET qty_invoiced = COALESCE(qty_invoiced, 0) + ail.quantity
        FROM public.ap_invoice_lines ail
        WHERE ail.invoice_id = NEW.id
        AND pol.id = ail.po_line_id;
    END IF;
    
    RETURN NEW;
END;
$$;

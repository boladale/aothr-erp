
CREATE OR REPLACE FUNCTION public.update_po_line_qty_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Update qty_received for all lines in this GRN
        UPDATE public.purchase_order_lines pol
        SET qty_received = COALESCE(pol.qty_received, 0) + grl.qty_received
        FROM public.goods_receipt_lines grl
        WHERE grl.grn_id = NEW.id
        AND pol.id = grl.po_line_id;
        
        -- Update PO status based on receipt
        UPDATE public.purchase_orders po
        SET status = CASE
            WHEN (SELECT COUNT(*) FROM public.purchase_order_lines WHERE po_id = po.id AND purchase_order_lines.qty_received < purchase_order_lines.quantity) = 0 
            THEN 'fully_received'::po_status
            ELSE 'partially_received'::po_status
        END
        WHERE po.id = NEW.po_id
        AND po.status IN ('sent', 'partially_received');
    END IF;
    
    RETURN NEW;
END;
$function$;

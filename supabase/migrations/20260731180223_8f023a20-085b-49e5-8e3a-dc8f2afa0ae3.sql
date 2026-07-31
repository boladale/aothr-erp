CREATE OR REPLACE FUNCTION public.po_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://erp.aothr.com/purchase-orders/' || NEW.id::text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending_approval' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'po_submitted',
        'Purchase Order ' || NEW.po_number || ' submitted for approval',
        'Purchase Order ' || NEW.po_number || ' has been submitted and is awaiting approval.',
        v_url, ARRAY['admin','procurement_manager'], ARRAY[NEW.created_by]);
    ELSIF NEW.status = 'approved' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'po_approved',
        'Purchase Order ' || NEW.po_number || ' approved',
        'Purchase Order ' || NEW.po_number || ' has been approved.',
        v_url, ARRAY['admin','procurement_manager','procurement_officer','finance_manager','warehouse_manager'], ARRAY[NEW.created_by]);
    ELSIF NEW.status = 'sent' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'po_sent_to_vendor',
        'Purchase Order ' || NEW.po_number || ' sent to vendor',
        'Purchase Order ' || NEW.po_number || ' has been dispatched to the vendor.',
        v_url, ARRAY['admin','procurement_manager','procurement_officer'], ARRAY[NEW.created_by]);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_status_email ON public.purchase_orders;
CREATE TRIGGER trg_po_status_email
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.po_status_email();
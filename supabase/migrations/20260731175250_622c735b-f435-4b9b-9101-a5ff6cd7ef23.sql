CREATE OR REPLACE FUNCTION public.audit_po_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, before_data, after_data, organization_id)
        VALUES (
            'purchase_orders',
            NEW.id,
            'status_changed',
            COALESCE(auth.uid(), NEW.approved_by, NEW.created_by),
            jsonb_build_object('status', OLD.status::text, 'po_number', OLD.po_number),
            jsonb_build_object('status', NEW.status::text, 'po_number', NEW.po_number),
            COALESCE(NEW.organization_id, OLD.organization_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_po_ready_for_closure()
RETURNS trigger
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

        SELECT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE entity_type = 'purchase_orders'
            AND entity_id = NEW.id
            AND notification_type = 'po_ready_to_close'
        ) INTO notification_exists;

        IF NOT notification_exists AND po_record.created_by IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id, entity_type, entity_id, notification_type, title, message, organization_id
            ) VALUES (
                po_record.created_by,
                'purchase_orders',
                NEW.id,
                'po_ready_to_close',
                'PO Ready to Close',
                'Purchase Order ' || po_record.po_number || ' is ready for closure.',
                COALESCE(NEW.organization_id, po_record.organization_id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
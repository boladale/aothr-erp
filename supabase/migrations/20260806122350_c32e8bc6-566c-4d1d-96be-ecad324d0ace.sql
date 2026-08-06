CREATE OR REPLACE FUNCTION public.audit_grn_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
    IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, organization_id, before_data, after_data)
        VALUES (
            'goods_receipts', NEW.id, 'posted', COALESCE(auth.uid(), NEW.posted_by), NEW.organization_id,
            jsonb_build_object('grn_number', NEW.grn_number, 'po_id', NEW.po_id),
            jsonb_build_object('grn_number', NEW.grn_number, 'po_id', NEW.po_id, 'posted_at', NEW.posted_at)
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- audit_logs must never block a business transaction when the org cannot be derived
CREATE OR REPLACE FUNCTION public.audit_logs_set_org_soft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_org_id();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_auto_org_id ON public.audit_logs;
CREATE TRIGGER tr_auto_org_id BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.audit_logs_set_org_soft();
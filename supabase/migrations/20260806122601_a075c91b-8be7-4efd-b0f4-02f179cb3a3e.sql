CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
  _actor_id uuid := auth.uid();
  _org uuid;
  _row jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created'; _row := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated'; _row := to_jsonb(NEW);
  ELSE
    _action := 'deleted'; _row := to_jsonb(OLD);
  END IF;

  BEGIN
    _org := NULLIF(_row->>'organization_id','')::uuid;
  EXCEPTION WHEN others THEN
    _org := NULL;
  END;

  IF _org IS NULL THEN
    _org := public.get_user_org_id();
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, actor_id, organization_id, before_data, after_data)
    VALUES (
      TG_TABLE_NAME,
      COALESCE((_row->>'id')::uuid, gen_random_uuid()),
      _action,
      _actor_id,
      _org,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE _row END
    );
  EXCEPTION WHEN others THEN
    NULL; -- never let audit logging block a business transaction
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
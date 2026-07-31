
CREATE OR REPLACE FUNCTION public.queue_event_email(
  p_org uuid,
  p_event_key text,
  p_subject text,
  p_message text,
  p_action_url text,
  p_roles text[] DEFAULT '{}',
  p_user_ids uuid[] DEFAULT '{}'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setting record;
  v_email text;
  v_recipients text[] := '{}';
  v_token text;
  v_msg_id uuid;
  v_html text;
  v_count int := 0;
BEGIN
  IF p_org IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_setting FROM public.email_event_settings
   WHERE organization_id = p_org AND event_key = p_event_key LIMIT 1;
  IF v_setting IS NULL OR v_setting.enabled IS NOT TRUE THEN RETURN 0; END IF;

  -- role based recipients (same organization only)
  IF array_length(p_roles, 1) > 0 THEN
    SELECT array_agg(DISTINCT pr.email) INTO v_recipients
      FROM public.profiles pr
      JOIN public.user_roles ur ON ur.user_id = pr.user_id
     WHERE pr.organization_id = p_org
       AND pr.email IS NOT NULL
       AND ur.role::text = ANY(p_roles);
  END IF;
  v_recipients := COALESCE(v_recipients, '{}');

  IF array_length(p_user_ids, 1) > 0 THEN
    v_recipients := v_recipients || COALESCE((
      SELECT array_agg(DISTINCT pr.email) FROM public.profiles pr
       WHERE pr.user_id = ANY(p_user_ids) AND pr.email IS NOT NULL
    ), '{}');
  END IF;

  v_recipients := v_recipients || COALESCE(v_setting.extra_emails, '{}');

  FOR v_email IN
    SELECT DISTINCT lower(trim(e)) FROM unnest(v_recipients) e
     WHERE e IS NOT NULL AND trim(e) <> '' AND e LIKE '%@%'
  LOOP
    -- skip suppressed addresses
    IF EXISTS (SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = v_email) THEN
      CONTINUE;
    END IF;

    SELECT token INTO v_token FROM public.email_unsubscribe_tokens
      WHERE email = v_email AND used_at IS NULL LIMIT 1;
    IF v_token IS NULL THEN
      v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.email_unsubscribe_tokens (token, email)
      VALUES (v_token, v_email)
      ON CONFLICT (email) DO NOTHING;
      SELECT token INTO v_token FROM public.email_unsubscribe_tokens WHERE email = v_email LIMIT 1;
    END IF;

    v_msg_id := gen_random_uuid();

    v_html :=
      '<html><body style="background:#ffffff;font-family:Arial,sans-serif;padding:24px;">' ||
      '<div style="max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">' ||
      '<h2 style="color:#1e293b;margin:0 0 12px;">' || coalesce(p_subject, 'Notification') || '</h2>' ||
      '<p style="color:#334155;font-size:15px;line-height:22px;">' || coalesce(p_message, '') || '</p>' ||
      CASE WHEN p_action_url IS NOT NULL AND p_action_url <> '' THEN
        '<p style="margin-top:20px;"><a href="' || p_action_url ||
        '" style="background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open in ERP</a></p>'
      ELSE '' END ||
      '</div></body></html>';

    INSERT INTO public.email_send_log (message_id, template_name, recipient_email, organization_id, status)
    VALUES (v_msg_id::text, p_event_key, v_email, p_org, 'pending');

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', v_msg_id::text,
      'to', v_email,
      'from', 'aothrerp <noreply@erp.aothr.com>',
      'sender_domain', 'notify.erp.aothr.com',
      'subject', coalesce(p_subject, 'Notification'),
      'html', v_html,
      'text', coalesce(p_message, ''),
      'purpose', 'transactional',
      'label', p_event_key,
      'idempotency_key', p_event_key || '-' || v_msg_id::text,
      'unsubscribe_token', v_token,
      'queued_at', now(),
      'organization_id', p_org
    ));

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.requisition_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://erp.aothr.com/requisitions/' || NEW.id::text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending_approval' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'pr_submitted',
        'Requisition ' || NEW.req_number || ' submitted for approval',
        'Purchase Requisition ' || NEW.req_number || ' has been submitted and is awaiting approval.',
        v_url, ARRAY['admin','procurement_manager'], ARRAY[]::uuid[]);
    ELSIF NEW.status = 'approved' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'pr_approved',
        'Requisition ' || NEW.req_number || ' approved',
        'Purchase Requisition ' || NEW.req_number || ' has been approved and can now be converted to an RFQ or Purchase Order.',
        v_url, ARRAY['admin','procurement_manager','procurement_officer'], ARRAY[NEW.requester_id]);
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.queue_event_email(
        NEW.organization_id, 'pr_rejected',
        'Requisition ' || NEW.req_number || ' returned for corrections',
        'Purchase Requisition ' || NEW.req_number || ' was not approved. Please review and resubmit.',
        v_url, ARRAY['admin','procurement_manager','procurement_officer'], ARRAY[NEW.requester_id]);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_requisition_status_email ON public.requisitions;
CREATE TRIGGER trg_requisition_status_email
AFTER UPDATE OF status ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION public.requisition_status_email();

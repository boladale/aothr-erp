
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.requisitions
   WHERE req_number='REQ-00007' AND organization_id='5e8ce8cd-369f-4cc6-8f3a-b64ccb1a03e4' LIMIT 1;
  IF r.id IS NOT NULL THEN
    PERFORM public.queue_event_email(
      r.organization_id, 'pr_approved',
      'Requisition ' || r.req_number || ' approved',
      'Purchase Requisition ' || r.req_number || ' has been approved and can now be converted to an RFQ or Purchase Order.',
      'https://erp.aothr.com/requisitions/' || r.id::text,
      ARRAY['admin','procurement_manager','procurement_officer'], ARRAY[r.requester_id]);
  END IF;
END $$;

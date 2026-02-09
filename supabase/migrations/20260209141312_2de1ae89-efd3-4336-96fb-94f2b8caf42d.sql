
-- Tighten requisition line INSERT: only allow if requisition is in draft/rejected
-- (Already enforced by trigger, but let's restrict UPDATE/DELETE to requester or managers)

-- Drop overly permissive policies on requisition_lines
DROP POLICY IF EXISTS "Users can update requisition lines" ON public.requisition_lines;
DROP POLICY IF EXISTS "Users can delete requisition lines" ON public.requisition_lines;

-- Replace with role-scoped policies
CREATE POLICY "Requester or managers can update requisition lines"
  ON public.requisition_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisitions r
      WHERE r.id = requisition_id
      AND (r.requester_id = auth.uid() OR public.has_role(auth.uid(), 'procurement_manager') OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Requester or managers can delete requisition lines"
  ON public.requisition_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.requisitions r
      WHERE r.id = requisition_id
      AND (r.requester_id = auth.uid() OR public.has_role(auth.uid(), 'procurement_manager') OR public.has_role(auth.uid(), 'admin'))
    )
  );

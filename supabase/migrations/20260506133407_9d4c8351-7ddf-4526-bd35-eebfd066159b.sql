-- Use security definer helpers to avoid recursive access checks when vendor users view invited RFPs
CREATE OR REPLACE FUNCTION public.is_current_vendor_user_for_vendor(_vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_users vu
    WHERE vu.vendor_id = _vendor_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_vendor_invited_to_rfp(_rfp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rfp_proposals p
    JOIN public.vendor_users vu ON vu.vendor_id = p.vendor_id
    WHERE p.rfp_id = _rfp_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  );
$$;

DROP POLICY IF EXISTS "Vendor users can view own rfp_proposals" ON public.rfp_proposals;
CREATE POLICY "Vendor users can view own rfp_proposals"
ON public.rfp_proposals
FOR SELECT
USING (public.is_current_vendor_user_for_vendor(vendor_id));

DROP POLICY IF EXISTS "Vendor users can update own rfp_proposals" ON public.rfp_proposals;
CREATE POLICY "Vendor users can update own rfp_proposals"
ON public.rfp_proposals
FOR UPDATE
USING (public.is_current_vendor_user_for_vendor(vendor_id))
WITH CHECK (public.is_current_vendor_user_for_vendor(vendor_id));

DROP POLICY IF EXISTS "Vendor users can insert own rfp_proposals" ON public.rfp_proposals;
CREATE POLICY "Vendor users can insert own rfp_proposals"
ON public.rfp_proposals
FOR INSERT
WITH CHECK (public.is_current_vendor_user_for_vendor(vendor_id));

DROP POLICY IF EXISTS "Vendor users can view invited rfps" ON public.rfps;
CREATE POLICY "Vendor users can view invited rfps"
ON public.rfps
FOR SELECT
USING (public.is_current_vendor_invited_to_rfp(id));

DROP POLICY IF EXISTS "Vendor users can view invited rfp_items" ON public.rfp_items;
CREATE POLICY "Vendor users can view invited rfp_items"
ON public.rfp_items
FOR SELECT
USING (public.is_current_vendor_invited_to_rfp(rfp_id));

DROP POLICY IF EXISTS "Vendor users can manage own proposal lines" ON public.rfp_proposal_lines;
CREATE POLICY "Vendor users can manage own proposal lines"
ON public.rfp_proposal_lines
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_proposals p
    WHERE p.id = rfp_proposal_lines.proposal_id
      AND public.is_current_vendor_user_for_vendor(p.vendor_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rfp_proposals p
    WHERE p.id = rfp_proposal_lines.proposal_id
      AND public.is_current_vendor_user_for_vendor(p.vendor_id)
  )
);
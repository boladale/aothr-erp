
-- Allow vendor users to view their own rfp_proposals and the parent RFPs/items
CREATE POLICY "Vendor users can view own rfp_proposals"
ON public.rfp_proposals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_users vu
    WHERE vu.vendor_id = rfp_proposals.vendor_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

CREATE POLICY "Vendor users can update own rfp_proposals"
ON public.rfp_proposals FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_users vu
    WHERE vu.vendor_id = rfp_proposals.vendor_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

CREATE POLICY "Vendor users can insert own rfp_proposals"
ON public.rfp_proposals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_users vu
    WHERE vu.vendor_id = rfp_proposals.vendor_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

CREATE POLICY "Vendor users can view invited rfps"
ON public.rfps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.vendor_users vu ON vu.vendor_id = p.vendor_id
    WHERE p.rfp_id = rfps.id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

CREATE POLICY "Vendor users can view invited rfp_items"
ON public.rfp_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.vendor_users vu ON vu.vendor_id = p.vendor_id
    WHERE p.rfp_id = rfp_items.rfp_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

CREATE POLICY "Vendor users can manage own proposal lines"
ON public.rfp_proposal_lines FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.vendor_users vu ON vu.vendor_id = p.vendor_id
    WHERE p.id = rfp_proposal_lines.proposal_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rfp_proposals p
    JOIN public.vendor_users vu ON vu.vendor_id = p.vendor_id
    WHERE p.id = rfp_proposal_lines.proposal_id
      AND vu.user_id = auth.uid()
      AND vu.is_active = true
  )
);

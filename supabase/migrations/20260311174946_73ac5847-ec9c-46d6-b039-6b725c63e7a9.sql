
-- Bid request header linked to a requisition
CREATE TABLE public.requisition_bid_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  status TEXT NOT NULL DEFAULT 'open',
  deadline DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual vendor bid entries per requisition line
CREATE TABLE public.requisition_bid_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id UUID NOT NULL REFERENCES public.requisition_bid_requests(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  requisition_line_id UUID NOT NULL REFERENCES public.requisition_lines(id) ON DELETE CASCADE,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bid_request_id, vendor_id, requisition_line_id)
);

-- Auto-set organization_id
CREATE TRIGGER tr_auto_org_id
  BEFORE INSERT ON public.requisition_bid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_organization_id();

-- Updated_at triggers
CREATE TRIGGER tr_updated_at_bid_requests
  BEFORE UPDATE ON public.requisition_bid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_updated_at_bid_entries
  BEFORE UPDATE ON public.requisition_bid_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.requisition_bid_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_bid_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org bid requests"
  ON public.requisition_bid_requests FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert bid requests for own org"
  ON public.requisition_bid_requests FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Users can update own org bid requests"
  ON public.requisition_bid_requests FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own org bid requests"
  ON public.requisition_bid_requests FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own org bid entries"
  ON public.requisition_bid_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisition_bid_requests br
    WHERE br.id = bid_request_id
    AND br.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can insert bid entries for own org"
  ON public.requisition_bid_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.requisition_bid_requests br
    WHERE br.id = bid_request_id
    AND br.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update own org bid entries"
  ON public.requisition_bid_entries FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisition_bid_requests br
    WHERE br.id = bid_request_id
    AND br.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can delete own org bid entries"
  ON public.requisition_bid_entries FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisition_bid_requests br
    WHERE br.id = bid_request_id
    AND br.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

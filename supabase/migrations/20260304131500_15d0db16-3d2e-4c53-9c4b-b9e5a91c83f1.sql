
-- RFP Status enum
CREATE TYPE public.rfp_status AS ENUM ('draft', 'published', 'evaluating', 'awarded', 'cancelled');

-- Proposal Status enum
CREATE TYPE public.proposal_status AS ENUM ('invited', 'submitted', 'awarded', 'rejected', 'declined');

-- ========== RFPs Table ==========
CREATE TABLE public.rfps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status public.rfp_status NOT NULL DEFAULT 'draft',
  deadline TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  awarded_vendor_id UUID REFERENCES public.vendors(id),
  awarded_proposal_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfps" ON public.rfps FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfps" ON public.rfps FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== RFP Items ==========
CREATE TABLE public.rfp_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC NOT NULL,
  specifications TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfp_items" ON public.rfp_items FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfp_items" ON public.rfp_items FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== RFP Evaluation Criteria ==========
CREATE TABLE public.rfp_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  criterion_name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfp_criteria" ON public.rfp_criteria FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfp_criteria" ON public.rfp_criteria FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== RFP Proposals (one per vendor per RFP) ==========
CREATE TABLE public.rfp_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  status public.proposal_status NOT NULL DEFAULT 'invited',
  total_amount NUMERIC DEFAULT 0,
  delivery_timeline_days INTEGER,
  cover_letter TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  weighted_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rfp_id, vendor_id)
);

ALTER TABLE public.rfp_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfp_proposals" ON public.rfp_proposals FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfp_proposals" ON public.rfp_proposals FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== RFP Proposal Line Items ==========
CREATE TABLE public.rfp_proposal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.rfp_proposals(id) ON DELETE CASCADE,
  rfp_item_id UUID NOT NULL REFERENCES public.rfp_items(id),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL,
  line_total NUMERIC,
  delivery_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_proposal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfp_proposal_lines" ON public.rfp_proposal_lines FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfp_proposal_lines" ON public.rfp_proposal_lines FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== RFP Evaluation Scores ==========
CREATE TABLE public.rfp_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.rfp_proposals(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.rfp_criteria(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  comments TEXT,
  evaluated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, criterion_id)
);

ALTER TABLE public.rfp_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view rfp_scores" ON public.rfp_scores FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage rfp_scores" ON public.rfp_scores FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- ========== Vendor Ratings (per completed PO) ==========
CREATE TABLE public.vendor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  comments TEXT,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, po_id)
);

ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view vendor_ratings" ON public.vendor_ratings FOR SELECT USING (true);
CREATE POLICY "Procurement and admin can manage vendor_ratings" ON public.vendor_ratings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

-- Add FK for awarded_proposal_id on rfps
ALTER TABLE public.rfps ADD CONSTRAINT rfps_awarded_proposal_id_fkey 
  FOREIGN KEY (awarded_proposal_id) REFERENCES public.rfp_proposals(id);

-- Updated_at triggers
CREATE TRIGGER update_rfps_updated_at BEFORE UPDATE ON public.rfps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfp_proposals_updated_at BEFORE UPDATE ON public.rfp_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Create requisition status enum
CREATE TYPE public.requisition_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'partially_converted', 'fully_converted'
);

-- Create requisitions table
CREATE TABLE public.requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  req_number TEXT NOT NULL UNIQUE,
  requester_id UUID NOT NULL,
  department TEXT,
  status public.requisition_status NOT NULL DEFAULT 'draft',
  justification TEXT,
  needed_by_date DATE,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create requisition lines table
CREATE TABLE public.requisition_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  estimated_unit_cost NUMERIC DEFAULT 0,
  estimated_total NUMERIC GENERATED ALWAYS AS (quantity * estimated_unit_cost) STORED,
  specifications TEXT,
  qty_converted NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create traceability link table
CREATE TABLE public.po_line_requisition_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_line_id UUID NOT NULL REFERENCES public.purchase_order_lines(id) ON DELETE CASCADE,
  requisition_line_id UUID NOT NULL REFERENCES public.requisition_lines(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(po_line_id, requisition_line_id)
);

-- Enable RLS
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_requisition_lines ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can view requisitions
CREATE POLICY "Authenticated users can view requisitions"
  ON public.requisitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create requisitions"
  ON public.requisitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Requester or managers can update requisitions"
  ON public.requisitions FOR UPDATE
  USING (
    auth.uid() = requester_id
    OR public.has_role(auth.uid(), 'procurement_manager')
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS for requisition lines
CREATE POLICY "Authenticated users can view requisition lines"
  ON public.requisition_lines FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage requisition lines"
  ON public.requisition_lines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update requisition lines"
  ON public.requisition_lines FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete requisition lines"
  ON public.requisition_lines FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS for traceability
CREATE POLICY "Authenticated users can view po_line_requisition_lines"
  ON public.po_line_requisition_lines FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Procurement can create po_line_requisition_lines"
  ON public.po_line_requisition_lines FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'procurement_manager')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Triggers
CREATE TRIGGER update_requisitions_updated_at
  BEFORE UPDATE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_requisitions
  AFTER INSERT OR UPDATE OR DELETE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

-- Lock requisition after submission
CREATE OR REPLACE FUNCTION public.enforce_requisition_lock()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status NOT IN ('draft', 'rejected') THEN
    IF NEW.department IS DISTINCT FROM OLD.department OR
       NEW.justification IS DISTINCT FROM OLD.justification OR
       NEW.needed_by_date IS DISTINCT FROM OLD.needed_by_date OR
       NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Requisition cannot be modified after submission. Status: %', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_requisition_lock
  BEFORE UPDATE ON public.requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_requisition_lock();

-- Lock requisition lines after submission
CREATE OR REPLACE FUNCTION public.enforce_requisition_line_lock()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  req_status requisition_status;
BEGIN
  SELECT status INTO req_status FROM public.requisitions WHERE id = COALESCE(NEW.requisition_id, OLD.requisition_id);
  
  IF req_status NOT IN ('draft', 'rejected') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete requisition lines after submission. Status: %', req_status;
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot add requisition lines after submission. Status: %', req_status;
    ELSIF NEW.item_id IS DISTINCT FROM OLD.item_id OR
          NEW.quantity IS DISTINCT FROM OLD.quantity OR
          NEW.estimated_unit_cost IS DISTINCT FROM OLD.estimated_unit_cost THEN
      RAISE EXCEPTION 'Cannot modify requisition lines after submission. Status: %', req_status;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_requisition_line_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.requisition_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_requisition_line_lock();

-- Update requisition status when lines are converted
CREATE OR REPLACE FUNCTION public.update_requisition_conversion_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_req_id UUID;
  v_all_converted BOOLEAN;
  v_any_converted BOOLEAN;
BEGIN
  SELECT rl.requisition_id INTO v_req_id
  FROM public.requisition_lines rl
  WHERE rl.id = NEW.requisition_line_id;

  -- Update qty_converted on the requisition line
  UPDATE public.requisition_lines
  SET qty_converted = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM public.po_line_requisition_lines
    WHERE requisition_line_id = NEW.requisition_line_id
  )
  WHERE id = NEW.requisition_line_id;

  -- Check if all lines are fully converted
  SELECT 
    NOT EXISTS (SELECT 1 FROM public.requisition_lines WHERE requisition_id = v_req_id AND qty_converted < quantity),
    EXISTS (SELECT 1 FROM public.requisition_lines WHERE requisition_id = v_req_id AND qty_converted > 0)
  INTO v_all_converted, v_any_converted;

  UPDATE public.requisitions
  SET status = CASE
    WHEN v_all_converted THEN 'fully_converted'::requisition_status
    WHEN v_any_converted THEN 'partially_converted'::requisition_status
    ELSE status
  END
  WHERE id = v_req_id AND status IN ('approved', 'partially_converted');

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_requisition_conversion_status
  AFTER INSERT ON public.po_line_requisition_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_requisition_conversion_status();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.requisitions;

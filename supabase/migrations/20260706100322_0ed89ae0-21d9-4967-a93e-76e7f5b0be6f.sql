
DO $$ BEGIN
  CREATE TYPE public.ap_credit_note_status AS ENUM ('draft','posted','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.ap_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  credit_note_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  invoice_id uuid REFERENCES public.ap_invoices(id),
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  currency text NOT NULL DEFAULT 'NGN',
  exchange_rate numeric NOT NULL DEFAULT 1,
  subtotal numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  reason text,
  status public.ap_credit_note_status NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ap_credit_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.ap_credit_notes(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_credit_notes TO authenticated;
GRANT ALL ON public.ap_credit_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_credit_note_lines TO authenticated;
GRANT ALL ON public.ap_credit_note_lines TO service_role;

ALTER TABLE public.ap_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_credit_note_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read ap credit notes" ON public.ap_credit_notes
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "org members write ap credit notes" ON public.ap_credit_notes
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "org members read ap credit note lines" ON public.ap_credit_note_lines
  FOR SELECT TO authenticated
  USING (credit_note_id IN (SELECT id FROM public.ap_credit_notes WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "org members write ap credit note lines" ON public.ap_credit_note_lines
  FOR ALL TO authenticated
  USING (credit_note_id IN (SELECT id FROM public.ap_credit_notes WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())))
  WITH CHECK (credit_note_id IN (SELECT id FROM public.ap_credit_notes WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));

CREATE TRIGGER update_ap_credit_notes_updated_at BEFORE UPDATE ON public.ap_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent editing lines when parent is posted
CREATE OR REPLACE FUNCTION public.prevent_ap_cn_edit_when_posted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.ap_credit_note_status;
BEGIN
  SELECT status INTO s FROM public.ap_credit_notes WHERE id = COALESCE(NEW.credit_note_id, OLD.credit_note_id);
  IF s <> 'draft' THEN
    RAISE EXCEPTION 'Cannot modify lines of a % credit note', s;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_ap_cn_lines_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.ap_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ap_cn_edit_when_posted();

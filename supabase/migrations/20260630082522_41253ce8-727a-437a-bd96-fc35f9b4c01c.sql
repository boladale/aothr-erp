
CREATE OR REPLACE FUNCTION public.prevent_ap_overpayment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
  v_allocated numeric;
BEGIN
  SELECT COALESCE(total_amount, 0) INTO v_total FROM public.ap_invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated
    FROM public.ap_payment_allocations
    WHERE invoice_id = NEW.invoice_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF (v_allocated + COALESCE(NEW.allocated_amount, 0)) > v_total + 0.01 THEN
    RAISE EXCEPTION 'Total allocations (%) exceed invoice total (%) for invoice %',
      (v_allocated + NEW.allocated_amount), v_total, NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ap_overpayment ON public.ap_payment_allocations;
CREATE TRIGGER trg_prevent_ap_overpayment
BEFORE INSERT OR UPDATE ON public.ap_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.prevent_ap_overpayment();

CREATE OR REPLACE FUNCTION public.prevent_ar_overreceipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
  v_allocated numeric;
BEGIN
  SELECT COALESCE(total_amount, 0) INTO v_total FROM public.ar_invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated
    FROM public.ar_receipt_allocations
    WHERE invoice_id = NEW.invoice_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF (v_allocated + COALESCE(NEW.allocated_amount, 0)) > v_total + 0.01 THEN
    RAISE EXCEPTION 'Total receipts (%) exceed invoice total (%) for invoice %',
      (v_allocated + NEW.allocated_amount), v_total, NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ar_overreceipt ON public.ar_receipt_allocations;
CREATE TRIGGER trg_prevent_ar_overreceipt
BEFORE INSERT OR UPDATE ON public.ar_receipt_allocations
FOR EACH ROW EXECUTE FUNCTION public.prevent_ar_overreceipt();

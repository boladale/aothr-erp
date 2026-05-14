CREATE OR REPLACE FUNCTION public.enforce_transfer_stock_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_location uuid;
  v_available numeric;
  v_item_name text;
BEGIN
  SELECT from_location_id INTO v_source_location
  FROM public.inventory_transfers WHERE id = NEW.transfer_id;

  SELECT COALESCE(quantity, 0) INTO v_available
  FROM public.inventory_balances
  WHERE item_id = NEW.item_id AND location_id = v_source_location;

  v_available := COALESCE(v_available, 0);

  IF NEW.quantity > v_available THEN
    SELECT name INTO v_item_name FROM public.items WHERE id = NEW.item_id;
    RAISE EXCEPTION 'Insufficient stock for % at source warehouse. Requested: %, Available: %',
      COALESCE(v_item_name, NEW.item_id::text), NEW.quantity, v_available;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transfer_stock_availability ON public.inventory_transfer_lines;
CREATE TRIGGER trg_enforce_transfer_stock_availability
BEFORE INSERT OR UPDATE ON public.inventory_transfer_lines
FOR EACH ROW EXECUTE FUNCTION public.enforce_transfer_stock_availability();
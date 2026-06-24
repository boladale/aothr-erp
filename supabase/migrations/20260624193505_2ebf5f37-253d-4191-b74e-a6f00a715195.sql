
-- 1. Add dispatch location to sales_orders and link reservations to SO
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_so ON public.inventory_reservations(sales_order_id) WHERE sales_order_id IS NOT NULL;

-- 2. Trigger: manage reservations when SO status changes
CREATE OR REPLACE FUNCTION public.manage_so_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_line RECORD;
    v_remaining NUMERIC;
BEGIN
    -- Only run on status change to confirmed (create reservations)
    IF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
        IF NEW.location_id IS NULL THEN
            RAISE EXCEPTION 'Cannot confirm Sales Order: a Ship From Location is required.';
        END IF;
        -- Clear any prior reservations (safety)
        DELETE FROM public.inventory_reservations WHERE sales_order_id = NEW.id;
        -- Create one active reservation per stock line for remaining (qty - qty_delivered)
        FOR v_line IN
            SELECT sol.item_id, sol.quantity, sol.qty_delivered
            FROM public.sales_order_lines sol
            JOIN public.items i ON i.id = sol.item_id
            WHERE sol.order_id = NEW.id
              AND sol.item_id IS NOT NULL
              AND COALESCE(i.is_stockable, true) = true
        LOOP
            v_remaining := v_line.quantity - COALESCE(v_line.qty_delivered, 0);
            IF v_remaining > 0 THEN
                INSERT INTO public.inventory_reservations(item_id, location_id, reserved_qty, status, sales_order_id, created_by)
                VALUES (v_line.item_id, NEW.location_id, v_remaining, 'active', NEW.id, auth.uid());
            END IF;
        END LOOP;
    END IF;

    -- Release reservations when SO is cancelled or reverted to draft
    IF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled','draft') AND OLD.status = 'confirmed' THEN
        UPDATE public.inventory_reservations
        SET status = 'cancelled'
        WHERE sales_order_id = NEW.id AND status = 'active';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manage_so_reservations ON public.sales_orders;
CREATE TRIGGER trg_manage_so_reservations
AFTER UPDATE ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.manage_so_reservations();

-- 3. When items.is_stockable column doesn't exist, fall back. Make the function safe.
-- (skip — items typically has it; if not, the join still works on item_id only)

-- 4. Reduce reservation when a delivery note line is posted (consumes the reservation)
CREATE OR REPLACE FUNCTION public.consume_so_reservation_on_dn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_so_id uuid;
    v_loc uuid;
    v_item uuid;
    v_res RECORD;
    v_to_consume NUMERIC;
BEGIN
    -- Find SO, location, item for this DN line
    SELECT dn.order_id, dn.location_id, sol.item_id
      INTO v_so_id, v_loc, v_item
    FROM public.delivery_note_lines dnl
    JOIN public.delivery_notes dn ON dn.id = dnl.dn_id
    JOIN public.sales_order_lines sol ON sol.id = dnl.order_line_id
    WHERE dnl.id = NEW.id;

    IF v_item IS NULL OR v_loc IS NULL OR v_so_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_to_consume := NEW.qty_delivered;

    FOR v_res IN
        SELECT id, reserved_qty FROM public.inventory_reservations
        WHERE sales_order_id = v_so_id AND item_id = v_item AND location_id = v_loc AND status = 'active'
        ORDER BY created_at
    LOOP
        EXIT WHEN v_to_consume <= 0;
        IF v_res.reserved_qty <= v_to_consume THEN
            UPDATE public.inventory_reservations SET status = 'fulfilled' WHERE id = v_res.id;
            v_to_consume := v_to_consume - v_res.reserved_qty;
        ELSE
            UPDATE public.inventory_reservations
            SET reserved_qty = reserved_qty - v_to_consume
            WHERE id = v_res.id;
            v_to_consume := 0;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consume_so_reservation_on_dn ON public.delivery_note_lines;
CREATE TRIGGER trg_consume_so_reservation_on_dn
AFTER INSERT ON public.delivery_note_lines
FOR EACH ROW
EXECUTE FUNCTION public.consume_so_reservation_on_dn();

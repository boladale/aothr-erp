
-- 1. Weigh-bill column (add if missing) + NOT NULL
ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS weigh_bill_number text;
UPDATE public.goods_receipts SET weigh_bill_number = 'LEGACY-' || grn_number
WHERE weigh_bill_number IS NULL OR btrim(weigh_bill_number) = '';
ALTER TABLE public.goods_receipts ALTER COLUMN weigh_bill_number SET NOT NULL;

-- 2. Inventory Transfer tables
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  from_location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  rejection_reason text,
  source_approved_by uuid REFERENCES auth.users(id),
  source_approved_at timestamptz,
  destination_approved_by uuid REFERENCES auth.users(id),
  destination_approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_location_id <> to_location_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity numeric(15,4) NOT NULL CHECK (quantity > 0),
  line_number int NOT NULL,
  unit_cost numeric(15,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_transfers_org ON public.inventory_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_lines_xfer ON public.inventory_transfer_lines(transfer_id);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View org transfers" ON public.inventory_transfers
  FOR SELECT TO authenticated USING (organization_id = get_user_org_id());
CREATE POLICY "Manage org transfers" ON public.inventory_transfers
  FOR ALL TO authenticated
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "View org transfer lines" ON public.inventory_transfer_lines
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.inventory_transfers t
            WHERE t.id = inventory_transfer_lines.transfer_id
              AND t.organization_id = get_user_org_id()));
CREATE POLICY "Manage org transfer lines" ON public.inventory_transfer_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_transfers t
                 WHERE t.id = inventory_transfer_lines.transfer_id
                   AND t.organization_id = get_user_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_transfers t
                      WHERE t.id = inventory_transfer_lines.transfer_id
                        AND t.organization_id = get_user_org_id()));

CREATE TRIGGER trg_inventory_transfers_updated
BEFORE UPDATE ON public.inventory_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.process_inventory_transfer_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_layer RECORD;
  v_remaining numeric;
  v_consume numeric;
  v_total_cost numeric;
  v_avg_cost numeric;
  v_total_qty numeric;
BEGIN
  IF NEW.status = 'in_transit' AND OLD.status = 'pending_source_approval' THEN
    FOR v_line IN SELECT * FROM inventory_transfer_lines WHERE transfer_id = NEW.id LOOP
      v_remaining := v_line.quantity;
      v_total_cost := 0;
      v_total_qty := 0;
      FOR v_layer IN
        SELECT * FROM inventory_costing_layers
        WHERE item_id = v_line.item_id AND location_id = NEW.from_location_id AND remaining_qty > 0
        ORDER BY receipt_date, created_at
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_consume := LEAST(v_layer.remaining_qty, v_remaining);
        UPDATE inventory_costing_layers SET remaining_qty = remaining_qty - v_consume WHERE id = v_layer.id;
        v_total_cost := v_total_cost + v_consume * v_layer.unit_cost;
        v_total_qty := v_total_qty + v_consume;
        v_remaining := v_remaining - v_consume;
      END LOOP;
      v_avg_cost := CASE WHEN v_total_qty > 0 THEN v_total_cost / v_total_qty ELSE 0 END;
      UPDATE inventory_transfer_lines SET unit_cost = v_avg_cost WHERE id = v_line.id;
      UPDATE inventory_balances
        SET quantity = quantity - v_line.quantity, last_updated = now()
        WHERE item_id = v_line.item_id AND location_id = NEW.from_location_id;
    END LOOP;
    NEW.source_approved_at := COALESCE(NEW.source_approved_at, now());
  END IF;

  IF NEW.status = 'received' AND OLD.status = 'in_transit' THEN
    FOR v_line IN SELECT * FROM inventory_transfer_lines WHERE transfer_id = NEW.id LOOP
      INSERT INTO inventory_balances (item_id, location_id, quantity, organization_id)
      VALUES (v_line.item_id, NEW.to_location_id, v_line.quantity, NEW.organization_id)
      ON CONFLICT (item_id, location_id) DO UPDATE
        SET quantity = inventory_balances.quantity + EXCLUDED.quantity, last_updated = now();

      INSERT INTO inventory_costing_layers
        (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost, organization_id)
      VALUES
        (v_line.item_id, NEW.to_location_id, 'transfer', NEW.id, NEW.transfer_date,
         v_line.quantity, v_line.quantity, v_line.unit_cost, NEW.organization_id);
    END LOOP;
    NEW.destination_approved_at := COALESCE(NEW.destination_approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_transfer_state
BEFORE UPDATE OF status ON public.inventory_transfers
FOR EACH ROW EXECUTE FUNCTION public.process_inventory_transfer_state();

-- 3. Allow warehouse roles to close a PO
DROP POLICY IF EXISTS "Warehouse can close POs" ON public.purchase_orders;
CREATE POLICY "Warehouse can close POs" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id() AND close_ready = true
         AND (has_role(auth.uid(), 'warehouse_manager'::app_role)
              OR has_role(auth.uid(), 'warehouse_officer'::app_role)))
  WITH CHECK (organization_id = get_user_org_id() AND status = 'closed');

-- 4. Notifications
CREATE OR REPLACE FUNCTION public.notify_procurement_grn_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po RECORD; v_user RECORD;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    SELECT po_number INTO v_po FROM purchase_orders WHERE id = NEW.po_id;
    FOR v_user IN
      SELECT DISTINCT ur.user_id FROM user_roles ur
      JOIN profiles p ON p.user_id = ur.user_id
      WHERE p.organization_id = NEW.organization_id
        AND ur.role IN ('procurement_manager','procurement_officer','admin')
    LOOP
      INSERT INTO notifications (user_id, entity_type, entity_id, notification_type, title, message, organization_id)
      VALUES (v_user.user_id, 'goods_receipts', NEW.id, 'grn_posted',
              'Goods Delivered',
              'GRN ' || NEW.grn_number || ' for PO ' || COALESCE(v_po.po_number,'') || ' has been posted.',
              NEW.organization_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_procurement_grn
AFTER UPDATE ON public.goods_receipts
FOR EACH ROW EXECUTE FUNCTION public.notify_procurement_grn_posted();

CREATE OR REPLACE FUNCTION public.notify_procurement_po_closed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user RECORD;
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    FOR v_user IN
      SELECT DISTINCT ur.user_id FROM user_roles ur
      JOIN profiles p ON p.user_id = ur.user_id
      WHERE p.organization_id = NEW.organization_id
        AND ur.role IN ('procurement_manager','procurement_officer','admin')
    LOOP
      INSERT INTO notifications (user_id, entity_type, entity_id, notification_type, title, message, organization_id)
      VALUES (v_user.user_id, 'purchase_orders', NEW.id, 'po_closed',
              'PO Closed',
              'Purchase Order ' || NEW.po_number || ' has been closed.',
              NEW.organization_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_procurement_po_closed
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_procurement_po_closed();

CREATE OR REPLACE FUNCTION public.notify_procurement_po_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po RECORD; v_user RECORD;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    FOR v_po IN
      SELECT DISTINCT po.id, po.po_number FROM purchase_orders po
      JOIN ap_invoices i ON i.po_id = po.id
      JOIN ap_payment_allocations a ON a.invoice_id = i.id
      WHERE a.payment_id = NEW.id
    LOOP
      FOR v_user IN
        SELECT DISTINCT ur.user_id FROM user_roles ur
        JOIN profiles p ON p.user_id = ur.user_id
        WHERE p.organization_id = NEW.organization_id
          AND ur.role IN ('procurement_manager','procurement_officer','admin')
      LOOP
        INSERT INTO notifications (user_id, entity_type, entity_id, notification_type, title, message, organization_id)
        VALUES (v_user.user_id, 'purchase_orders', v_po.id, 'po_paid',
                'PO Payment Posted',
                'Payment ' || NEW.payment_number || ' has been posted against PO ' || v_po.po_number || '.',
                NEW.organization_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_procurement_po_paid
AFTER UPDATE ON public.ap_payments
FOR EACH ROW EXECUTE FUNCTION public.notify_procurement_po_paid();

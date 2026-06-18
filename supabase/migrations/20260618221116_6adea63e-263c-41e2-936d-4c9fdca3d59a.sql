
-- 1. Add costing_method to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS costing_method text NOT NULL DEFAULT 'fifo'
  CHECK (costing_method IN ('fifo','weighted_average'));

-- 2. Replace consume_fifo_layers to honour per-item costing method
CREATE OR REPLACE FUNCTION public.consume_fifo_layers(
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_consumption_type text,
  p_source_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method text;
  v_remaining numeric := p_quantity;
  v_layer RECORD;
  v_consume_qty numeric;
  v_total_cost numeric := 0;
  v_avg_cost numeric;
  v_total_qty numeric;
  v_total_value numeric;
BEGIN
  SELECT costing_method INTO v_method FROM items WHERE id = p_item_id;

  IF v_method = 'weighted_average' THEN
    SELECT COALESCE(SUM(remaining_qty), 0),
           COALESCE(SUM(remaining_qty * unit_cost), 0)
      INTO v_total_qty, v_total_value
      FROM inventory_costing_layers
      WHERE item_id = p_item_id
        AND location_id = p_location_id
        AND remaining_qty > 0;

    IF v_total_qty <= 0 THEN
      RETURN 0;
    END IF;

    v_avg_cost := v_total_value / v_total_qty;

    FOR v_layer IN
      SELECT id, remaining_qty
      FROM inventory_costing_layers
      WHERE item_id = p_item_id
        AND location_id = p_location_id
        AND remaining_qty > 0
      ORDER BY receipt_date ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consume_qty := LEAST(v_layer.remaining_qty, v_remaining);

      UPDATE inventory_costing_layers
        SET remaining_qty = remaining_qty - v_consume_qty
        WHERE id = v_layer.id;

      INSERT INTO inventory_costing_consumptions
        (layer_id, consumption_type, consumption_source_id, quantity, unit_cost)
      VALUES
        (v_layer.id, p_consumption_type, p_source_id, v_consume_qty, v_avg_cost);

      v_total_cost := v_total_cost + (v_consume_qty * v_avg_cost);
      v_remaining := v_remaining - v_consume_qty;
    END LOOP;

    RETURN v_total_cost;
  END IF;

  -- Default: FIFO behaviour
  FOR v_layer IN
    SELECT id, remaining_qty, unit_cost
    FROM inventory_costing_layers
    WHERE item_id = p_item_id
      AND location_id = p_location_id
      AND remaining_qty > 0
    ORDER BY receipt_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_consume_qty := LEAST(v_layer.remaining_qty, v_remaining);

    UPDATE inventory_costing_layers
      SET remaining_qty = remaining_qty - v_consume_qty
      WHERE id = v_layer.id;

    INSERT INTO inventory_costing_consumptions
      (layer_id, consumption_type, consumption_source_id, quantity, unit_cost)
    VALUES
      (v_layer.id, p_consumption_type, p_source_id, v_consume_qty, v_layer.unit_cost);

    v_total_cost := v_total_cost + (v_consume_qty * v_layer.unit_cost);
    v_remaining := v_remaining - v_consume_qty;
  END LOOP;

  RETURN v_total_cost;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_so_line_qty_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_line RECORD;
    v_layer_cost NUMERIC;
    v_total_cost NUMERIC := 0;
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_inventory_account_id UUID;
    v_cogs_account_id UUID;
    v_line_num INT := 0;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();

        IF NEW.location_id IS NULL THEN
            RAISE EXCEPTION 'Dispatch location is required before posting a delivery note.';
        END IF;

        -- Update qty_delivered on SO lines
        UPDATE sales_order_lines sol
        SET qty_delivered = COALESCE(qty_delivered, 0) + dnl.qty_delivered
        FROM delivery_note_lines dnl
        WHERE dnl.dn_id = NEW.id AND sol.id = dnl.order_line_id;

        -- Update SO status
        UPDATE sales_orders so
        SET status = CASE
            WHEN (SELECT COUNT(*) FROM sales_order_lines WHERE order_id = so.id AND qty_delivered < quantity) = 0
            THEN 'fully_delivered'::sales_order_status
            ELSE 'partially_delivered'::sales_order_status
        END
        WHERE so.id = NEW.order_id AND so.status IN ('confirmed', 'partially_delivered');

        -- Prepare GL journal
        SELECT id INTO v_period_id FROM gl_fiscal_periods
          WHERE NEW.delivery_date BETWEEN start_date AND end_date AND status = 'open'
            AND organization_id = NEW.organization_id
          LIMIT 1;

        SELECT id INTO v_inventory_account_id FROM gl_accounts
          WHERE account_code = '1400' AND is_active = true AND organization_id = NEW.organization_id LIMIT 1;
        SELECT id INTO v_cogs_account_id FROM gl_accounts
          WHERE account_code = '5100' AND is_active = true AND organization_id = NEW.organization_id LIMIT 1;

        IF v_inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1400 - Inventory" not found.';
        END IF;
        IF v_cogs_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "5100 - Cost of Goods Sold" not found.';
        END IF;

        v_entry_number := 'DN-' || NEW.dn_number;

        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.delivery_date, 'Delivery Note: ' || NEW.dn_number, 'delivery_note', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;

        -- Consume FIFO, decrement balances per line
        FOR v_line IN
            SELECT dnl.id, COALESCE(dnl.item_id, sol.item_id) AS item_id, dnl.qty_delivered
            FROM delivery_note_lines dnl
            JOIN sales_order_lines sol ON sol.id = dnl.order_line_id
            WHERE dnl.dn_id = NEW.id
        LOOP
            IF v_line.item_id IS NULL THEN
                CONTINUE;
            END IF;

            v_layer_cost := consume_fifo_layers(v_line.item_id, NEW.location_id, v_line.qty_delivered, 'delivery_note', v_line.id);

            UPDATE inventory_balances
              SET quantity = quantity - v_line.qty_delivered, last_updated = now()
              WHERE item_id = v_line.item_id AND location_id = NEW.location_id;

            IF v_layer_cost > 0 THEN
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description)
                VALUES (v_entry_id, v_line_num, v_cogs_account_id, v_layer_cost, 0, 'COGS - DN ' || NEW.dn_number);

                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description)
                VALUES (v_entry_id, v_line_num, v_inventory_account_id, 0, v_layer_cost, 'Inventory relief - DN ' || NEW.dn_number);

                v_total_cost := v_total_cost + v_layer_cost;
            END IF;
        END LOOP;

        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        ELSE
            DELETE FROM gl_journal_entries WHERE id = v_entry_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;


-- Add inventory_balances update to the gl_post_grn_and_create_layers trigger
-- so inventory is updated atomically at the database level, not from the frontend.
CREATE OR REPLACE FUNCTION public.gl_post_grn_and_create_layers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_inventory_account_id UUID;
    v_accrual_account_id UUID;
    v_line RECORD;
    v_line_num INT := 0;
    v_total_cost NUMERIC := 0;
    v_unit_cost NUMERIC;
    v_existing_balance UUID;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Find fiscal period
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.receipt_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        -- Get GL accounts
        SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code = '1400' AND is_active = true;
        SELECT id INTO v_accrual_account_id FROM gl_accounts WHERE account_code = '2200' AND is_active = true;
        
        IF v_inventory_account_id IS NULL OR v_accrual_account_id IS NULL THEN
            RAISE EXCEPTION 'Required GL accounts (1400 Inventory, 2200 GRN Accrual) not found.';
        END IF;
        
        v_entry_number := 'GRN-' || NEW.grn_number;
        
        -- Create journal entry
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.receipt_date, 'Goods Receipt: ' || NEW.grn_number, 'inventory', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;
        
        -- Process each GRN line
        FOR v_line IN 
            SELECT grl.id, grl.item_id, grl.qty_received, grl.po_line_id,
                   pol.unit_price
            FROM goods_receipt_lines grl
            JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
            WHERE grl.grn_id = NEW.id
        LOOP
            v_unit_cost := COALESCE(v_line.unit_price, 0);
            
            -- Create FIFO costing layer
            INSERT INTO inventory_costing_layers (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost, organization_id)
            VALUES (v_line.item_id, NEW.location_id, 'grn', v_line.id, NEW.receipt_date, v_line.qty_received, v_line.qty_received, v_unit_cost, NEW.organization_id);
            
            -- Update inventory balances (upsert)
            SELECT id INTO v_existing_balance FROM inventory_balances
            WHERE item_id = v_line.item_id AND location_id = NEW.location_id;
            
            IF v_existing_balance IS NOT NULL THEN
                UPDATE inventory_balances
                SET quantity = quantity + v_line.qty_received,
                    last_updated = now()
                WHERE item_id = v_line.item_id AND location_id = NEW.location_id;
            ELSE
                INSERT INTO inventory_balances (item_id, location_id, quantity, organization_id)
                VALUES (v_line.item_id, NEW.location_id, v_line.qty_received, NEW.organization_id);
            END IF;
            
            -- DR: Inventory for each line
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_inventory_account_id, v_line.qty_received * v_unit_cost, 0, 'Inventory receipt');
            
            v_total_cost := v_total_cost + (v_line.qty_received * v_unit_cost);
        END LOOP;
        
        -- CR: GRN Accrual (total)
        v_line_num := v_line_num + 1;
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, v_line_num, v_accrual_account_id, 0, v_total_cost, 'GRN Accrual - ' || NEW.grn_number);
        
        -- Post journal entry (if there's cost)
        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted', posted_at = now(), posted_by = auth.uid() WHERE id = v_entry_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

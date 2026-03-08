
-- ============================================
-- Module 5: Inventory Accounting (FIFO Costing)
-- ============================================

-- 1. FIFO Costing Layers table
CREATE TABLE public.inventory_costing_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id),
    location_id UUID NOT NULL REFERENCES public.locations(id),
    source_type TEXT NOT NULL DEFAULT 'grn', -- grn, adjustment, opening
    source_id UUID, -- goods_receipt_lines.id or inventory_adjustment_lines.id
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    original_qty NUMERIC NOT NULL,
    remaining_qty NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC GENERATED ALWAYS AS (remaining_qty * unit_cost) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. FIFO consumption log (tracks which layers were consumed)
CREATE TABLE public.inventory_costing_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES public.inventory_costing_layers(id),
    consumption_type TEXT NOT NULL DEFAULT 'adjustment', -- adjustment, issue, sale
    consumption_source_id UUID, -- source document id
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.inventory_costing_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_costing_consumptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for costing layers
CREATE POLICY "Auth users can view inventory_costing_layers"
    ON public.inventory_costing_layers FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage inventory_costing_layers"
    ON public.inventory_costing_layers FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view inventory_costing_consumptions"
    ON public.inventory_costing_consumptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can manage inventory_costing_consumptions"
    ON public.inventory_costing_consumptions FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager') OR has_role(auth.uid(), 'warehouse_officer') OR has_role(auth.uid(), 'accounts_payable'));

-- 4. Seed GL accounts for inventory accounting (if not exist)
INSERT INTO public.gl_accounts (account_code, account_name, account_type, normal_balance, description, is_active)
VALUES 
    ('1400', 'Inventory', 'asset', 'debit', 'Inventory asset account for FIFO costing', true),
    ('2200', 'GRN Accrual', 'liability', 'credit', 'Goods received not yet invoiced accrual', true)
ON CONFLICT (account_code) DO NOTHING;

-- 5. GL posting trigger on GRN post: DR 1400 Inventory / CR 2200 GRN Accrual
-- Also creates FIFO costing layers
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
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.receipt_date, 'Goods Receipt: ' || NEW.grn_number, 'inventory', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- Process each GRN line: create costing layer and journal lines
        FOR v_line IN 
            SELECT grl.id, grl.item_id, grl.qty_received, grl.po_line_id,
                   pol.unit_price
            FROM goods_receipt_lines grl
            JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
            WHERE grl.grn_id = NEW.id
        LOOP
            v_unit_cost := COALESCE(v_line.unit_price, 0);
            
            -- Create FIFO costing layer
            INSERT INTO inventory_costing_layers (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost)
            VALUES (v_line.item_id, NEW.location_id, 'grn', v_line.id, NEW.receipt_date, v_line.qty_received, v_line.qty_received, v_unit_cost);
            
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
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_grn_and_create_layers
    BEFORE UPDATE ON public.goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.gl_post_grn_and_create_layers();

-- 6. FIFO consumption function: consumes oldest layers first
CREATE OR REPLACE FUNCTION public.consume_fifo_layers(
    p_item_id UUID,
    p_location_id UUID,
    p_quantity NUMERIC,
    p_consumption_type TEXT,
    p_source_id UUID
)
RETURNS NUMERIC -- returns total cost consumed
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_remaining NUMERIC := p_quantity;
    v_layer RECORD;
    v_consume_qty NUMERIC;
    v_total_cost NUMERIC := 0;
BEGIN
    FOR v_layer IN
        SELECT id, remaining_qty, unit_cost
        FROM inventory_costing_layers
        WHERE item_id = p_item_id AND location_id = p_location_id AND remaining_qty > 0
        ORDER BY receipt_date ASC, created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;
        
        v_consume_qty := LEAST(v_layer.remaining_qty, v_remaining);
        
        -- Reduce layer
        UPDATE inventory_costing_layers SET remaining_qty = remaining_qty - v_consume_qty WHERE id = v_layer.id;
        
        -- Log consumption
        INSERT INTO inventory_costing_consumptions (layer_id, consumption_type, consumption_source_id, quantity, unit_cost)
        VALUES (v_layer.id, p_consumption_type, p_source_id, v_consume_qty, v_layer.unit_cost);
        
        v_total_cost := v_total_cost + (v_consume_qty * v_layer.unit_cost);
        v_remaining := v_remaining - v_consume_qty;
    END LOOP;
    
    RETURN v_total_cost;
END;
$$;

-- 7. GL posting trigger on inventory adjustment (decrease): DR 5100 COGS / CR 1400 Inventory
-- For increase adjustments: DR 1400 Inventory / CR 4900 Other Income (adjustment gain)
CREATE OR REPLACE FUNCTION public.gl_post_inventory_adjustment()
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
    v_cogs_account_id UUID;
    v_other_income_account_id UUID;
    v_line RECORD;
    v_line_num INT := 0;
    v_total_cost NUMERIC := 0;
    v_layer_cost NUMERIC;
    v_item_unit_cost NUMERIC;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.adjustment_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code = '1400' AND is_active = true;
        SELECT id INTO v_cogs_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_other_income_account_id FROM gl_accounts WHERE account_code = '4900' AND is_active = true;
        
        IF v_inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1400 - Inventory" not found.';
        END IF;
        
        v_entry_number := 'INV-ADJ-' || NEW.adjustment_number;
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.adjustment_date, 'Inventory Adjustment: ' || NEW.adjustment_number, 'inventory', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        FOR v_line IN 
            SELECT id, item_id, adjustment_type, quantity FROM inventory_adjustment_lines WHERE adjustment_id = NEW.id
        LOOP
            IF v_line.adjustment_type = 'decrease' THEN
                -- Consume FIFO layers
                v_layer_cost := consume_fifo_layers(v_line.item_id, NEW.location_id, v_line.quantity, 'adjustment', v_line.id);
                
                -- DR: COGS
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_cogs_account_id, v_layer_cost, 0, 'COGS - inventory adjustment');
                
                -- CR: Inventory
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_inventory_account_id, 0, v_layer_cost, 'Inventory reduction');
                
                v_total_cost := v_total_cost + v_layer_cost;
            ELSE
                -- Increase: use item's unit_cost to create a new layer
                SELECT COALESCE(unit_cost, 0) INTO v_item_unit_cost FROM items WHERE id = v_line.item_id;
                
                INSERT INTO inventory_costing_layers (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost)
                VALUES (v_line.item_id, NEW.location_id, 'adjustment', v_line.id, NEW.adjustment_date, v_line.quantity, v_line.quantity, v_item_unit_cost);
                
                v_layer_cost := v_line.quantity * v_item_unit_cost;
                
                -- DR: Inventory
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, v_inventory_account_id, v_layer_cost, 0, 'Inventory increase');
                
                -- CR: Other Income
                v_line_num := v_line_num + 1;
                INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
                VALUES (v_entry_id, v_line_num, COALESCE(v_other_income_account_id, v_inventory_account_id), 0, v_layer_cost, 'Adjustment gain');
                
                v_total_cost := v_total_cost + v_layer_cost;
            END IF;
        END LOOP;
        
        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_inventory_adjustment
    BEFORE UPDATE ON public.inventory_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION public.gl_post_inventory_adjustment();

-- 8. Add unique constraint on gl_accounts account_code if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gl_accounts_account_code_key') THEN
        ALTER TABLE public.gl_accounts ADD CONSTRAINT gl_accounts_account_code_key UNIQUE (account_code);
    END IF;
END $$;

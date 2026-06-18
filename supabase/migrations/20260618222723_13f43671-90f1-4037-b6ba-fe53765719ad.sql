
ALTER TABLE public.inventory_issues
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

CREATE OR REPLACE FUNCTION public.gl_post_inventory_issue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_inventory_account_id UUID;
    v_default_target_id UUID;
    v_line RECORD;
    v_line_num INT := 0;
    v_total_cost NUMERIC := 0;
    v_layer_cost NUMERIC;
    v_target_account UUID;
    v_item_name TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();

        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.issue_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;

        SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code = '1400' AND is_active = true;
        SELECT id INTO v_default_target_id FROM gl_accounts WHERE account_code = '1600' AND is_active = true;

        IF v_inventory_account_id IS NULL THEN
            RAISE EXCEPTION 'GL Account "1400 - Inventory" not found.';
        END IF;

        v_entry_number := 'INV-ISS-' || NEW.issue_number;

        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
        VALUES (v_entry_number, NEW.issue_date, 'Inventory Issue: ' || NEW.issue_number || COALESCE(' to ' || NEW.issued_to, ''), 'inventory', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
        RETURNING id INTO v_entry_id;

        FOR v_line IN
            SELECT id, item_id, quantity, target_gl_account_id FROM inventory_issue_lines WHERE issue_id = NEW.id
        LOOP
            v_layer_cost := consume_fifo_layers(v_line.item_id, NEW.location_id, v_line.quantity, 'issue', v_line.id);

            v_target_account := COALESCE(v_line.target_gl_account_id, v_default_target_id, v_inventory_account_id);

            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_target_account, v_layer_cost, 0, 'Issue to ' || COALESCE(NEW.issued_to, NEW.department, 'staff'));

            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_inventory_account_id, 0, v_layer_cost, 'Inventory reduction - issue');

            v_total_cost := v_total_cost + v_layer_cost;

            UPDATE inventory_balances
            SET quantity = quantity - v_line.quantity, last_updated = now()
            WHERE item_id = v_line.item_id AND location_id = NEW.location_id;

            -- If issue is linked to a project, record material cost against it.
            -- Insert with posted=true so gl_post_project_cost (BEFORE UPDATE) does NOT
            -- create a duplicate GL entry; reuse the inventory issue's journal entry.
            IF NEW.project_id IS NOT NULL AND v_layer_cost > 0 THEN
                SELECT name INTO v_item_name FROM items WHERE id = v_line.item_id;
                INSERT INTO project_costs (
                    project_id, cost_type, description, amount, cost_date,
                    source_module, source_id, gl_journal_entry_id,
                    posted, posted_at, posted_by, created_by, organization_id
                ) VALUES (
                    NEW.project_id, 'material',
                    'Inventory Issue ' || NEW.issue_number || ' - ' || COALESCE(v_item_name, 'Item') || ' x ' || v_line.quantity,
                    v_layer_cost, NEW.issue_date,
                    'inventory_issue', NEW.id, v_entry_id,
                    true, now(), auth.uid(), auth.uid(), NEW.organization_id
                );
            END IF;
        END LOOP;

        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

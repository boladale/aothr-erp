CREATE OR REPLACE FUNCTION public.gl_post_inventory_issue_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_issue RECORD;
  v_entry_id UUID;
  v_entry_number TEXT;
  v_period_id UUID;
  v_inventory_account_id UUID;
  v_default_target_id UUID;
  v_line RECORD;
  v_line_num INT := 0;
  v_total_cost NUMERIC := 0;
  v_unit_cost NUMERIC;
  v_line_cost NUMERIC;
  v_target_account UUID;
  v_item_name TEXT;
  v_issue_line RECORD;
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
    NEW.posted_at := now();
    NEW.posted_by := auth.uid();

    SELECT * INTO v_issue FROM inventory_issues WHERE id = NEW.issue_id;
    IF v_issue.status <> 'posted' THEN
      RAISE EXCEPTION 'Cannot return against a non-posted issue';
    END IF;

    SELECT id INTO v_period_id FROM gl_fiscal_periods
      WHERE NEW.return_date BETWEEN start_date AND end_date AND status='open' LIMIT 1;

    SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code='1400' AND is_active=true;
    SELECT id INTO v_default_target_id FROM gl_accounts WHERE account_code='1600' AND is_active=true;

    IF v_inventory_account_id IS NULL THEN
      RAISE EXCEPTION 'GL Account "1400 - Inventory" not found.';
    END IF;

    v_entry_number := 'INV-RET-' || NEW.return_number;
    INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by, organization_id)
    VALUES (v_entry_number, NEW.return_date,
            'Inventory Issue Return: ' || NEW.return_number || ' (ref ' || v_issue.issue_number || ')',
            'inventory', NEW.id, v_period_id, 'draft', auth.uid(), NEW.organization_id)
    RETURNING id INTO v_entry_id;

    FOR v_line IN
      SELECT * FROM inventory_issue_return_lines WHERE return_id = NEW.id
    LOOP
      SELECT * INTO v_issue_line FROM inventory_issue_lines WHERE id = v_line.issue_line_id;
      IF v_issue_line.id IS NULL THEN
        RAISE EXCEPTION 'Issue line not found';
      END IF;

      SELECT CASE WHEN SUM(quantity) > 0 THEN SUM(total_cost)/SUM(quantity) ELSE 0 END
        INTO v_unit_cost
        FROM inventory_costing_consumptions
       WHERE consumption_source_id = v_issue_line.id AND consumption_type='issue';

      v_unit_cost := COALESCE(v_unit_cost, 0);
      v_line_cost := v_unit_cost * v_line.quantity;

      UPDATE inventory_issue_return_lines SET unit_cost = v_unit_cost WHERE id = v_line.id;

      v_target_account := COALESCE(v_issue_line.target_gl_account_id, v_default_target_id, v_inventory_account_id);

      v_line_num := v_line_num + 1;
      INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
      VALUES (v_entry_id, v_line_num, v_inventory_account_id, v_line_cost, 0, 'Return to stock - ' || NEW.return_number);

      v_line_num := v_line_num + 1;
      INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
      VALUES (v_entry_id, v_line_num, v_target_account, 0, v_line_cost, 'Reverse issue cost - ' || NEW.return_number);

      v_total_cost := v_total_cost + v_line_cost;

      UPDATE inventory_balances
        SET quantity = quantity + v_line.quantity, last_updated = now()
       WHERE item_id = v_line.item_id AND location_id = v_issue.location_id;

      IF NOT FOUND THEN
        INSERT INTO inventory_balances (item_id, location_id, quantity, organization_id)
        VALUES (v_line.item_id, v_issue.location_id, v_line.quantity, NEW.organization_id);
      END IF;

      -- total_cost is a GENERATED column (remaining_qty * unit_cost) — do not insert it
      INSERT INTO inventory_costing_layers
        (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost, organization_id)
      VALUES
        (v_line.item_id, v_issue.location_id, 'issue_return', NEW.id, NEW.return_date,
         v_line.quantity, v_line.quantity, v_unit_cost, NEW.organization_id);

      IF v_issue.project_id IS NOT NULL AND v_line_cost > 0 THEN
        SELECT name INTO v_item_name FROM items WHERE id = v_line.item_id;
        INSERT INTO project_costs (
          project_id, cost_type, description, amount, cost_date,
          source_module, source_id, gl_journal_entry_id,
          posted, posted_at, posted_by, created_by, organization_id
        ) VALUES (
          v_issue.project_id, 'material',
          'Issue Return ' || NEW.return_number || ' - ' || COALESCE(v_item_name,'Item') || ' x ' || v_line.quantity,
          -v_line_cost, NEW.return_date,
          'inventory_issue_return', NEW.id, v_entry_id,
          true, now(), auth.uid(), auth.uid(), NEW.organization_id
        );
      END IF;
    END LOOP;

    UPDATE inventory_issue_returns SET gl_journal_entry_id = v_entry_id WHERE id = NEW.id;
    NEW.gl_journal_entry_id := v_entry_id;

    UPDATE gl_journal_entries SET status='posted', posted_at=now(), posted_by=auth.uid() WHERE id = v_entry_id;
  END IF;
  RETURN NEW;
END;
$function$;
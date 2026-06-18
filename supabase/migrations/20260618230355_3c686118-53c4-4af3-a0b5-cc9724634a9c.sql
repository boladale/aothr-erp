
-- ISS-05: Inventory Issue Returns (reversal)

CREATE TABLE public.inventory_issue_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT NOT NULL,
  issue_id UUID NOT NULL REFERENCES public.inventory_issues(id) ON DELETE RESTRICT,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  organization_id UUID NOT NULL,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  gl_journal_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, return_number)
);

CREATE TABLE public.inventory_issue_return_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.inventory_issue_returns(id) ON DELETE CASCADE,
  issue_line_id UUID NOT NULL REFERENCES public.inventory_issue_lines(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_issue_returns TO authenticated;
GRANT ALL ON public.inventory_issue_returns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_issue_return_lines TO authenticated;
GRANT ALL ON public.inventory_issue_return_lines TO service_role;

ALTER TABLE public.inventory_issue_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issue_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage returns" ON public.inventory_issue_returns
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Org members manage return lines" ON public.inventory_issue_return_lines
  FOR ALL TO authenticated
  USING (return_id IN (SELECT id FROM inventory_issue_returns WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())))
  WITH CHECK (return_id IN (SELECT id FROM inventory_issue_returns WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE TRIGGER trg_inv_issue_returns_updated_at
  BEFORE UPDATE ON public.inventory_issue_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Posting trigger: reverses GL, restores inventory, refunds project cost
CREATE OR REPLACE FUNCTION public.gl_post_inventory_issue_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_orig_qty NUMERIC;
  v_already_returned NUMERIC;
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

      v_orig_qty := v_issue_line.quantity;
      SELECT COALESCE(SUM(quantity),0) INTO v_already_returned
        FROM inventory_issue_return_lines rl
        JOIN inventory_issue_returns r ON r.id = rl.return_id
       WHERE rl.issue_line_id = v_line.issue_line_id
         AND r.status='posted' AND r.id <> NEW.id;

      IF (v_already_returned + v_line.quantity) > v_orig_qty THEN
        RAISE EXCEPTION 'Return qty (% incl previous %) exceeds issued qty % for line', v_line.quantity, v_already_returned, v_orig_qty;
      END IF;

      -- weighted average unit cost of original consumption for this issue line
      SELECT CASE WHEN SUM(quantity) > 0 THEN SUM(total_cost)/SUM(quantity) ELSE 0 END
        INTO v_unit_cost
        FROM inventory_costing_consumptions
       WHERE consumption_source_id = v_issue_line.id AND consumption_type='issue';

      v_unit_cost := COALESCE(v_unit_cost, 0);
      v_line_cost := v_unit_cost * v_line.quantity;

      UPDATE inventory_issue_return_lines SET unit_cost = v_unit_cost WHERE id = v_line.id;

      v_target_account := COALESCE(v_issue_line.target_gl_account_id, v_default_target_id, v_inventory_account_id);

      -- Reverse GL: DR Inventory, CR original target account
      v_line_num := v_line_num + 1;
      INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
      VALUES (v_entry_id, v_line_num, v_inventory_account_id, v_line_cost, 0, 'Return to stock - ' || NEW.return_number);

      v_line_num := v_line_num + 1;
      INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
      VALUES (v_entry_id, v_line_num, v_target_account, 0, v_line_cost, 'Reverse issue cost - ' || NEW.return_number);

      v_total_cost := v_total_cost + v_line_cost;

      -- Restore inventory balance
      UPDATE inventory_balances
        SET quantity = quantity + v_line.quantity, last_updated = now()
       WHERE item_id = v_line.item_id AND location_id = v_issue.location_id;

      -- If no row exists yet, create one
      IF NOT FOUND THEN
        INSERT INTO inventory_balances (item_id, location_id, quantity, organization_id)
        VALUES (v_line.item_id, v_issue.location_id, v_line.quantity, NEW.organization_id);
      END IF;

      -- Create a new costing layer for returned stock (acts as fresh receipt at original cost)
      INSERT INTO inventory_costing_layers
        (item_id, location_id, source_type, source_id, receipt_date, original_qty, remaining_qty, unit_cost, total_cost, organization_id)
      VALUES
        (v_line.item_id, v_issue.location_id, 'issue_return', NEW.id, NEW.return_date,
         v_line.quantity, v_line.quantity, v_unit_cost, v_line_cost, NEW.organization_id);

      -- Reverse project cost if applicable
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

    IF v_total_cost > 0 THEN
      UPDATE gl_journal_entries SET status='posted' WHERE id = v_entry_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_inventory_issue_return
  BEFORE UPDATE ON public.inventory_issue_returns
  FOR EACH ROW EXECUTE FUNCTION public.gl_post_inventory_issue_return();

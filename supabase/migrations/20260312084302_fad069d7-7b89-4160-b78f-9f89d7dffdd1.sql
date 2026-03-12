
-- Create inventory issue status enum
CREATE TYPE public.issue_status AS ENUM ('draft', 'posted');

-- Inventory Issues header
CREATE TABLE public.inventory_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number TEXT NOT NULL UNIQUE,
    location_id UUID NOT NULL REFERENCES public.locations(id),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_to TEXT,
    department TEXT,
    notes TEXT,
    status issue_status NOT NULL DEFAULT 'draft',
    organization_id UUID REFERENCES public.organizations(id),
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory Issue Lines
CREATE TABLE public.inventory_issue_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.inventory_issues(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id),
    quantity NUMERIC NOT NULL,
    target_gl_account_id UUID REFERENCES public.gl_accounts(id),
    description TEXT
);

-- Enable RLS
ALTER TABLE public.inventory_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issue_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users (org-scoped)
CREATE POLICY "Users can view inventory issues in their org"
ON public.inventory_issues FOR SELECT TO authenticated
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert inventory issues"
ON public.inventory_issues FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update inventory issues in their org"
ON public.inventory_issues FOR UPDATE TO authenticated
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view issue lines"
ON public.inventory_issue_lines FOR SELECT TO authenticated
USING (issue_id IN (SELECT id FROM inventory_issues WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert issue lines"
ON public.inventory_issue_lines FOR INSERT TO authenticated
WITH CHECK (issue_id IN (SELECT id FROM inventory_issues WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Users can delete issue lines"
ON public.inventory_issue_lines FOR DELETE TO authenticated
USING (issue_id IN (SELECT id FROM inventory_issues WHERE organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

-- GL posting trigger for inventory issues
-- DR: target_gl_account_id (e.g. Fixed Assets 1600) per line using FIFO cost
-- CR: Inventory (1400)
CREATE OR REPLACE FUNCTION public.gl_post_inventory_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();

        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.issue_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;

        SELECT id INTO v_inventory_account_id FROM gl_accounts WHERE account_code = '1400' AND is_active = true;
        -- Default to Fixed Assets if no account selected
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
            -- Consume FIFO layers
            v_layer_cost := consume_fifo_layers(v_line.item_id, NEW.location_id, v_line.quantity, 'issue', v_line.id);

            v_target_account := COALESCE(v_line.target_gl_account_id, v_default_target_id, v_inventory_account_id);

            -- DR: Target account (Fixed Assets, Expense, etc.)
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_target_account, v_layer_cost, 0, 'Issue to ' || COALESCE(NEW.issued_to, NEW.department, 'staff'));

            -- CR: Inventory
            v_line_num := v_line_num + 1;
            INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
            VALUES (v_entry_id, v_line_num, v_inventory_account_id, 0, v_layer_cost, 'Inventory reduction - issue');

            v_total_cost := v_total_cost + v_layer_cost;

            -- Reduce inventory balance
            UPDATE inventory_balances
            SET quantity = quantity - v_line.quantity, last_updated = now()
            WHERE item_id = v_line.item_id AND location_id = NEW.location_id;
        END LOOP;

        IF v_total_cost > 0 THEN
            UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_inventory_issue
BEFORE UPDATE ON public.inventory_issues
FOR EACH ROW EXECUTE FUNCTION public.gl_post_inventory_issue();

-- Prevent un-posting
CREATE OR REPLACE FUNCTION public.prevent_issue_unpost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'posted' AND NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot un-post an inventory issue.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_issue_unpost
BEFORE UPDATE ON public.inventory_issues
FOR EACH ROW EXECUTE FUNCTION public.prevent_issue_unpost();

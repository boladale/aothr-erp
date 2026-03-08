
-- ============================================
-- Module 6: Project Accounting (Cost Tracking)
-- ============================================

-- 1. Project status enum
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');

-- 2. Cost type enum
CREATE TYPE public.project_cost_type AS ENUM ('labor', 'material', 'expense', 'subcontract', 'overhead');

-- 3. Projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code TEXT NOT NULL UNIQUE,
    project_name TEXT NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'planning',
    client_name TEXT,
    start_date DATE,
    end_date DATE,
    budgeted_amount NUMERIC NOT NULL DEFAULT 0,
    total_costs NUMERIC NOT NULL DEFAULT 0,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    profit_margin NUMERIC GENERATED ALWAYS AS (
        CASE WHEN total_revenue > 0 THEN ((total_revenue - total_costs) / total_revenue) * 100 ELSE 0 END
    ) STORED,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Project costs table
CREATE TABLE public.project_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    cost_type project_cost_type NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_module TEXT, -- accounts_payable, inventory, manual
    source_id UUID, -- ap_invoices.id, inventory_adjustments.id, etc.
    gl_journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
    posted BOOLEAN NOT NULL DEFAULT false,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Project revenue table
CREATE TABLE public.project_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    revenue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_module TEXT, -- accounts_receivable, manual
    source_id UUID,
    gl_journal_entry_id UUID REFERENCES public.gl_journal_entries(id),
    posted BOOLEAN NOT NULL DEFAULT false,
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_revenues ENABLE ROW LEVEL SECURITY;

-- RLS: projects
CREATE POLICY "Auth users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage projects" ON public.projects FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'procurement_manager'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'procurement_manager'));

-- RLS: project_costs
CREATE POLICY "Auth users can view project_costs" ON public.project_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage project_costs" ON public.project_costs FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- RLS: project_revenues
CREATE POLICY "Auth users can view project_revenues" ON public.project_revenues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance and admin can manage project_revenues" ON public.project_revenues FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable') OR has_role(auth.uid(), 'ap_clerk'));

-- 7. Trigger to update project totals when costs are added/changed
CREATE OR REPLACE FUNCTION public.update_project_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_project_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'project_costs' THEN
        v_project_id := COALESCE(NEW.project_id, OLD.project_id);
        UPDATE projects SET 
            total_costs = (SELECT COALESCE(SUM(amount), 0) FROM project_costs WHERE project_id = v_project_id AND posted = true),
            updated_at = now()
        WHERE id = v_project_id;
    ELSIF TG_TABLE_NAME = 'project_revenues' THEN
        v_project_id := COALESCE(NEW.project_id, OLD.project_id);
        UPDATE projects SET 
            total_revenue = (SELECT COALESCE(SUM(amount), 0) FROM project_revenues WHERE project_id = v_project_id AND posted = true),
            updated_at = now()
        WHERE id = v_project_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_project_cost_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.project_costs
    FOR EACH ROW EXECUTE FUNCTION public.update_project_totals();

CREATE TRIGGER trg_update_project_revenue_totals
    AFTER INSERT OR UPDATE OR DELETE ON public.project_revenues
    FOR EACH ROW EXECUTE FUNCTION public.update_project_totals();

-- 8. GL posting trigger for project costs
CREATE OR REPLACE FUNCTION public.gl_post_project_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_period_id UUID;
    v_expense_account_id UUID;
    v_bank_account_id UUID;
    v_project RECORD;
BEGIN
    IF NEW.posted = true AND OLD.posted = false THEN
        NEW.posted_at := now();
        NEW.posted_by := auth.uid();
        
        SELECT id INTO v_period_id FROM gl_fiscal_periods
        WHERE NEW.cost_date BETWEEN start_date AND end_date AND status = 'open' LIMIT 1;
        
        SELECT id INTO v_expense_account_id FROM gl_accounts WHERE account_code = '5100' AND is_active = true;
        SELECT id INTO v_bank_account_id FROM gl_accounts WHERE account_code = '1200' AND is_active = true;
        SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;
        
        IF v_expense_account_id IS NULL OR v_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Required GL accounts (5100, 1200) not found.';
        END IF;
        
        v_entry_number := 'PRJ-COST-' || v_project.project_code || '-' || to_char(now(), 'YYYYMMDD-HH24MISS');
        
        INSERT INTO gl_journal_entries (entry_number, entry_date, description, source_module, source_id, fiscal_period_id, status, created_by)
        VALUES (v_entry_number, NEW.cost_date, 'Project Cost: ' || v_project.project_name || ' - ' || NEW.description, 'project_accounting', NEW.id, v_period_id, 'draft', auth.uid())
        RETURNING id INTO v_entry_id;
        
        -- DR: Expense
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 1, v_expense_account_id, NEW.amount, 0, 'Project: ' || v_project.project_code || ' - ' || NEW.description);
        
        -- CR: Bank/Cash
        INSERT INTO gl_journal_lines (journal_entry_id, line_number, account_id, debit, credit, description)
        VALUES (v_entry_id, 2, v_bank_account_id, 0, NEW.amount, 'Project cost payment');
        
        UPDATE gl_journal_entries SET status = 'posted' WHERE id = v_entry_id;
        
        NEW.gl_journal_entry_id := v_entry_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gl_post_project_cost
    BEFORE UPDATE ON public.project_costs
    FOR EACH ROW EXECUTE FUNCTION public.gl_post_project_cost();

-- 9. Updated_at trigger
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

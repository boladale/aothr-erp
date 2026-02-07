-- =============================================
-- PHASE 2: Finance-Grade Controls & Automation
-- Sprint 1: Foundation Migration
-- =============================================

-- 1. Create new enums for Phase 2
CREATE TYPE public.match_line_status AS ENUM (
    'matched',
    'qty_exception',
    'price_exception',
    'missing_grn',
    'missing_invoice'
);

CREATE TYPE public.match_run_status AS ENUM (
    'pending',
    'matched',
    'exceptions_found',
    'resolved'
);

CREATE TYPE public.approval_step_type AS ENUM (
    'sequential',
    'parallel',
    'any_of'
);

CREATE TYPE public.approval_action_type AS ENUM (
    'approved',
    'rejected',
    'delegated',
    'escalated'
);

CREATE TYPE public.approval_instance_status AS ENUM (
    'pending',
    'in_progress',
    'approved',
    'rejected',
    'cancelled'
);

CREATE TYPE public.hold_type AS ENUM (
    'match_exception',
    'approval_pending',
    'budget_exceeded',
    'manual'
);

CREATE TYPE public.budget_status AS ENUM (
    'draft',
    'active',
    'closed',
    'frozen'
);

CREATE TYPE public.budget_source_type AS ENUM (
    'po_commitment',
    'invoice_actual'
);

CREATE TYPE public.budget_transaction_type AS ENUM (
    'commit',
    'uncommit',
    'consume',
    'reverse'
);

CREATE TYPE public.reservation_status AS ENUM (
    'active',
    'fulfilled',
    'cancelled',
    'expired'
);

-- =============================================
-- 2. Three-Way Matching Tables
-- =============================================

CREATE TABLE public.match_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.ap_invoices(id) ON DELETE CASCADE,
    run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    match_status match_run_status NOT NULL DEFAULT 'pending',
    tolerance_pct NUMERIC NOT NULL DEFAULT 0,
    total_exceptions INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.match_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    match_run_id UUID NOT NULL REFERENCES public.match_runs(id) ON DELETE CASCADE,
    po_line_id UUID NOT NULL REFERENCES public.purchase_order_lines(id),
    grn_line_id UUID REFERENCES public.goods_receipt_lines(id),
    invoice_line_id UUID NOT NULL REFERENCES public.ap_invoice_lines(id),
    qty_po NUMERIC NOT NULL,
    qty_grn NUMERIC NOT NULL DEFAULT 0,
    qty_invoice NUMERIC NOT NULL,
    price_po NUMERIC NOT NULL,
    price_invoice NUMERIC NOT NULL,
    variance_amt NUMERIC NOT NULL DEFAULT 0,
    match_status match_line_status NOT NULL DEFAULT 'matched'
);

-- Indexes for match tables
CREATE INDEX idx_match_runs_invoice ON public.match_runs(invoice_id);
CREATE INDEX idx_match_runs_status ON public.match_runs(match_status);
CREATE INDEX idx_match_lines_run ON public.match_lines(match_run_id);
CREATE INDEX idx_match_lines_status ON public.match_lines(match_status);

-- =============================================
-- 3. Approval Engine Tables
-- =============================================

CREATE TABLE public.approval_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(entity_type, rule_name)
);

CREATE TABLE public.approval_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id UUID NOT NULL REFERENCES public.approval_rules(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type approval_step_type NOT NULL DEFAULT 'sequential',
    approver_role app_role,
    approver_user_id UUID REFERENCES auth.users(id),
    delegation_user_id UUID REFERENCES auth.users(id),
    timeout_hours INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(rule_id, step_order)
);

CREATE TABLE public.approval_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id UUID REFERENCES public.approval_rules(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    status approval_instance_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    submitted_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_actions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID NOT NULL REFERENCES public.approval_instances(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.approval_steps(id),
    step_order INTEGER NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    action approval_action_type NOT NULL,
    comments TEXT,
    acted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for approval tables
CREATE INDEX idx_approval_rules_entity ON public.approval_rules(entity_type, is_active);
CREATE INDEX idx_approval_steps_rule ON public.approval_steps(rule_id);
CREATE INDEX idx_approval_instances_entity ON public.approval_instances(entity_type, entity_id);
CREATE INDEX idx_approval_instances_status ON public.approval_instances(status);
CREATE INDEX idx_approval_actions_instance ON public.approval_actions(instance_id);

-- =============================================
-- 4. AP Automation Tables
-- =============================================

CREATE TABLE public.invoice_holds (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.ap_invoices(id) ON DELETE CASCADE,
    hold_type hold_type NOT NULL,
    hold_reason TEXT NOT NULL,
    match_run_id UUID REFERENCES public.match_runs(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT
);

CREATE TABLE public.invoice_approvals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.ap_invoices(id) ON DELETE CASCADE,
    approval_instance_id UUID REFERENCES public.approval_instances(id),
    status approval_instance_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for AP automation tables
CREATE INDEX idx_invoice_holds_invoice ON public.invoice_holds(invoice_id);
CREATE INDEX idx_invoice_holds_unresolved ON public.invoice_holds(invoice_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_invoice_approvals_invoice ON public.invoice_approvals(invoice_id);

-- =============================================
-- 5. Budgeting Tables
-- =============================================

CREATE TABLE public.budgets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    fiscal_year INTEGER NOT NULL,
    status budget_status NOT NULL DEFAULT 'draft',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_lines (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    budgeted_amount NUMERIC NOT NULL DEFAULT 0,
    committed_amount NUMERIC NOT NULL DEFAULT 0,
    consumed_amount NUMERIC NOT NULL DEFAULT 0,
    available_amount NUMERIC GENERATED ALWAYS AS (budgeted_amount - committed_amount - consumed_amount) STORED,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(budget_id, category)
);

CREATE TABLE public.budget_consumption (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_line_id UUID NOT NULL REFERENCES public.budget_lines(id) ON DELETE CASCADE,
    source_type budget_source_type NOT NULL,
    source_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    transaction_type budget_transaction_type NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    posted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for budgeting tables
CREATE INDEX idx_budgets_fiscal_year ON public.budgets(fiscal_year, status);
CREATE INDEX idx_budget_lines_budget ON public.budget_lines(budget_id);
CREATE INDEX idx_budget_lines_category ON public.budget_lines(category);
CREATE INDEX idx_budget_consumption_line ON public.budget_consumption(budget_line_id);
CREATE INDEX idx_budget_consumption_source ON public.budget_consumption(source_type, source_id);

-- =============================================
-- 6. Inventory Extension Tables
-- =============================================

CREATE TABLE public.reorder_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    reorder_point NUMERIC NOT NULL DEFAULT 0,
    reorder_qty NUMERIC NOT NULL DEFAULT 0,
    lead_time_days INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(item_id, location_id)
);

CREATE TABLE public.inventory_reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES public.purchase_order_lines(id),
    reserved_qty NUMERIC NOT NULL,
    status reservation_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for inventory extension tables
CREATE INDEX idx_reorder_rules_item ON public.reorder_rules(item_id);
CREATE INDEX idx_reorder_rules_active ON public.reorder_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_inventory_reservations_item ON public.inventory_reservations(item_id, location_id);
CREATE INDEX idx_inventory_reservations_active ON public.inventory_reservations(status) WHERE status = 'active';

-- =============================================
-- 7. RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.match_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

-- Match runs & lines: All auth users can view, AP and admin can manage
CREATE POLICY "Auth users can view match_runs" ON public.match_runs FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage match_runs" ON public.match_runs FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view match_lines" ON public.match_lines FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage match_lines" ON public.match_lines FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

-- Approval rules & steps: All auth users can view, admin only can manage
CREATE POLICY "Auth users can view approval_rules" ON public.approval_rules FOR SELECT USING (true);
CREATE POLICY "Admin can manage approval_rules" ON public.approval_rules FOR ALL 
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users can view approval_steps" ON public.approval_steps FOR SELECT USING (true);
CREATE POLICY "Admin can manage approval_steps" ON public.approval_steps FOR ALL 
    USING (has_role(auth.uid(), 'admin'))
    WITH CHECK (has_role(auth.uid(), 'admin'));

-- Approval instances & actions: All auth users can view, system triggers insert
CREATE POLICY "Auth users can view approval_instances" ON public.approval_instances FOR SELECT USING (true);
CREATE POLICY "System can insert approval_instances" ON public.approval_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Approvers can update approval_instances" ON public.approval_instances FOR UPDATE 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

CREATE POLICY "Auth users can view approval_actions" ON public.approval_actions FOR SELECT USING (true);
CREATE POLICY "System can insert approval_actions" ON public.approval_actions FOR INSERT WITH CHECK (true);

-- Invoice holds & approvals: All auth users can view, AP and admin can manage
CREATE POLICY "Auth users can view invoice_holds" ON public.invoice_holds FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage invoice_holds" ON public.invoice_holds FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

CREATE POLICY "Auth users can view invoice_approvals" ON public.invoice_approvals FOR SELECT USING (true);
CREATE POLICY "AP and admin can manage invoice_approvals" ON public.invoice_approvals FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts_payable'));

-- Budgets & lines: All auth users can view, admin and procurement can manage
CREATE POLICY "Auth users can view budgets" ON public.budgets FOR SELECT USING (true);
CREATE POLICY "Admin and procurement can manage budgets" ON public.budgets FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

CREATE POLICY "Auth users can view budget_lines" ON public.budget_lines FOR SELECT USING (true);
CREATE POLICY "Admin and procurement can manage budget_lines" ON public.budget_lines FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'procurement_manager'));

CREATE POLICY "Auth users can view budget_consumption" ON public.budget_consumption FOR SELECT USING (true);
CREATE POLICY "System can insert budget_consumption" ON public.budget_consumption FOR INSERT WITH CHECK (true);

-- Reorder rules: All auth users can view, warehouse and admin can manage
CREATE POLICY "Auth users can view reorder_rules" ON public.reorder_rules FOR SELECT USING (true);
CREATE POLICY "Warehouse and admin can manage reorder_rules" ON public.reorder_rules FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'));

-- Inventory reservations: All auth users can view, warehouse and admin can manage
CREATE POLICY "Auth users can view inventory_reservations" ON public.inventory_reservations FOR SELECT USING (true);
CREATE POLICY "Warehouse and admin can manage reservations" ON public.inventory_reservations FOR ALL 
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'));

-- =============================================
-- 8. Three-Way Matching Engine Function
-- =============================================

CREATE OR REPLACE FUNCTION public.run_three_way_match(p_invoice_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_run_id UUID;
    v_invoice RECORD;
    v_invoice_line RECORD;
    v_po_line RECORD;
    v_total_grn_qty NUMERIC;
    v_line_status match_line_status;
    v_price_variance NUMERIC;
    v_tolerance_pct NUMERIC := 0;
    v_exception_count INTEGER := 0;
    v_run_status match_run_status;
BEGIN
    -- Get invoice details
    SELECT * INTO v_invoice FROM ap_invoices WHERE id = p_invoice_id;
    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;
    
    -- Create match run
    INSERT INTO match_runs (invoice_id, tolerance_pct, created_by)
    VALUES (p_invoice_id, v_tolerance_pct, auth.uid())
    RETURNING id INTO v_match_run_id;
    
    -- Process each invoice line
    FOR v_invoice_line IN 
        SELECT ail.*, pol.quantity AS po_qty, pol.unit_price AS po_price
        FROM ap_invoice_lines ail
        JOIN purchase_order_lines pol ON pol.id = ail.po_line_id
        WHERE ail.invoice_id = p_invoice_id
    LOOP
        -- Get total GRN quantity for this PO line
        SELECT COALESCE(SUM(grl.qty_received), 0) INTO v_total_grn_qty
        FROM goods_receipt_lines grl
        JOIN goods_receipts gr ON gr.id = grl.grn_id
        WHERE grl.po_line_id = v_invoice_line.po_line_id
        AND gr.status = 'posted';
        
        -- Determine match status
        v_line_status := 'matched';
        v_price_variance := v_invoice_line.unit_price - v_invoice_line.po_price;
        
        -- Check for missing GRN
        IF v_total_grn_qty = 0 THEN
            v_line_status := 'missing_grn';
            v_exception_count := v_exception_count + 1;
        -- Check quantity: invoice qty must be <= GRN qty
        ELSIF v_invoice_line.quantity > v_total_grn_qty THEN
            v_line_status := 'qty_exception';
            v_exception_count := v_exception_count + 1;
        -- Check price variance (with tolerance)
        ELSIF ABS(v_price_variance) > (v_invoice_line.po_price * v_tolerance_pct / 100) THEN
            v_line_status := 'price_exception';
            v_exception_count := v_exception_count + 1;
        END IF;
        
        -- Insert match line
        INSERT INTO match_lines (
            match_run_id, po_line_id, invoice_line_id,
            qty_po, qty_grn, qty_invoice,
            price_po, price_invoice, variance_amt, match_status
        ) VALUES (
            v_match_run_id, v_invoice_line.po_line_id, v_invoice_line.id,
            v_invoice_line.po_qty, v_total_grn_qty, v_invoice_line.quantity,
            v_invoice_line.po_price, v_invoice_line.unit_price, v_price_variance, v_line_status
        );
    END LOOP;
    
    -- Determine overall run status
    IF v_exception_count > 0 THEN
        v_run_status := 'exceptions_found';
    ELSE
        v_run_status := 'matched';
    END IF;
    
    -- Update match run with results
    UPDATE match_runs
    SET match_status = v_run_status, total_exceptions = v_exception_count
    WHERE id = v_match_run_id;
    
    RETURN v_match_run_id;
END;
$$;

-- =============================================
-- 9. Invoice Hold Enforcement Trigger
-- =============================================

CREATE OR REPLACE FUNCTION public.check_invoice_holds_before_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_unresolved_count INTEGER;
BEGIN
    -- Only check when status is changing to 'posted'
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Check for unresolved holds
        SELECT COUNT(*) INTO v_unresolved_count
        FROM invoice_holds
        WHERE invoice_id = NEW.id AND resolved_at IS NULL;
        
        IF v_unresolved_count > 0 THEN
            RAISE EXCEPTION 'Cannot post invoice: % unresolved hold(s) exist', v_unresolved_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_invoice_holds_trigger
BEFORE UPDATE ON public.ap_invoices
FOR EACH ROW
EXECUTE FUNCTION public.check_invoice_holds_before_post();

-- =============================================
-- 10. Three-Way Match on Invoice Post Attempt
-- =============================================

CREATE OR REPLACE FUNCTION public.trigger_three_way_match_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_run_id UUID;
    v_exception_count INTEGER;
BEGIN
    -- Only run when attempting to post from draft
    IF NEW.status = 'posted' AND OLD.status = 'draft' THEN
        -- Run three-way match
        v_match_run_id := run_three_way_match(NEW.id);
        
        -- Check if exceptions were found
        SELECT total_exceptions INTO v_exception_count
        FROM match_runs WHERE id = v_match_run_id;
        
        IF v_exception_count > 0 THEN
            -- Create invoice hold
            INSERT INTO invoice_holds (invoice_id, hold_type, hold_reason, match_run_id)
            VALUES (
                NEW.id,
                'match_exception',
                'Three-way match failed with ' || v_exception_count || ' exception(s)',
                v_match_run_id
            );
            
            -- Prevent post - revert status
            NEW.status := 'draft';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_three_way_match
BEFORE UPDATE ON public.ap_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trigger_three_way_match_on_post();

-- =============================================
-- 11. Reservation Validation Function
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC;
    v_total_reserved NUMERIC;
    v_available NUMERIC;
BEGIN
    -- Get current balance
    SELECT COALESCE(quantity, 0) INTO v_balance
    FROM inventory_balances
    WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
    
    -- Get total active reservations (excluding this one if updating)
    SELECT COALESCE(SUM(reserved_qty), 0) INTO v_total_reserved
    FROM inventory_reservations
    WHERE item_id = NEW.item_id 
    AND location_id = NEW.location_id
    AND status = 'active'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    v_available := v_balance - v_total_reserved;
    
    IF NEW.reserved_qty > v_available THEN
        RAISE EXCEPTION 'Cannot reserve % units. Available: %, Balance: %, Already reserved: %',
            NEW.reserved_qty, v_available, v_balance, v_total_reserved;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER validate_reservation_trigger
BEFORE INSERT OR UPDATE ON public.inventory_reservations
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.validate_reservation();

-- =============================================
-- 12. Audit Triggers for Phase 2 Tables
-- =============================================

CREATE TRIGGER audit_match_runs
AFTER INSERT OR UPDATE OR DELETE ON public.match_runs
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_invoice_holds
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_holds
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_budgets
AFTER INSERT OR UPDATE OR DELETE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_budget_lines
AFTER INSERT OR UPDATE OR DELETE ON public.budget_lines
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_approval_instances
AFTER INSERT OR UPDATE OR DELETE ON public.approval_instances
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_inventory_reservations
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_reservations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- =============================================
-- 13. Updated_at Triggers for Phase 2 Tables
-- =============================================

CREATE TRIGGER update_approval_rules_updated_at
BEFORE UPDATE ON public.approval_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_lines_updated_at
BEFORE UPDATE ON public.budget_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reorder_rules_updated_at
BEFORE UPDATE ON public.reorder_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
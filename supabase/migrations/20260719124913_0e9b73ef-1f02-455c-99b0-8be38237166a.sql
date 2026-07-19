
-- Helper: is this date in a closed/locked period for the given organization?
CREATE OR REPLACE FUNCTION public.is_period_closed(_org_id uuid, _entry_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gl_fiscal_periods
    WHERE organization_id = _org_id
      AND _entry_date BETWEEN start_date AND end_date
      AND status IN ('closed','locked')
  );
$$;

REVOKE ALL ON FUNCTION public.is_period_closed(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_period_closed(uuid, date) TO authenticated, service_role;

-- Trigger: block posting or modifying entries in a closed period
CREATE OR REPLACE FUNCTION public.enforce_fiscal_period_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_old_locked boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only enforce on new POSTED entries (drafts are OK to create in any period; they will be blocked on post)
    IF NEW.status = 'posted' AND public.is_period_closed(NEW.organization_id, NEW.entry_date) THEN
      RAISE EXCEPTION 'Cannot post journal entry: fiscal period covering % is closed or locked', NEW.entry_date
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_locked := public.is_period_closed(NEW.organization_id, NEW.entry_date);
    v_old_locked := public.is_period_closed(OLD.organization_id, OLD.entry_date);

    -- Transitioning draft -> posted into a closed period? blocked
    IF NEW.status = 'posted' AND OLD.status <> 'posted' AND v_locked THEN
      RAISE EXCEPTION 'Cannot post journal entry: fiscal period covering % is closed or locked', NEW.entry_date
        USING ERRCODE = 'check_violation';
    END IF;

    -- Editing amounts/dates of an already-posted entry whose period is closed
    IF OLD.status = 'posted' AND v_old_locked THEN
      IF NEW.entry_date <> OLD.entry_date
         OR NEW.total_debit <> OLD.total_debit
         OR NEW.total_credit <> OLD.total_credit THEN
        RAISE EXCEPTION 'Cannot modify a posted journal entry in a closed fiscal period. Use a reversing entry in an open period instead.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' AND public.is_period_closed(OLD.organization_id, OLD.entry_date) THEN
      RAISE EXCEPTION 'Cannot delete a posted journal entry in a closed fiscal period.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock ON public.gl_journal_entries;
CREATE TRIGGER trg_enforce_fiscal_period_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_fiscal_period_lock();

-- Also protect journal lines against edit/delete in closed periods
CREATE OR REPLACE FUNCTION public.enforce_fiscal_period_lock_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry record;
BEGIN
  SELECT organization_id, entry_date, status INTO v_entry
  FROM public.gl_journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  IF v_entry.status = 'posted' AND public.is_period_closed(v_entry.organization_id, v_entry.entry_date) THEN
    RAISE EXCEPTION 'Cannot modify journal lines of a posted entry in a closed fiscal period.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock_lines ON public.gl_journal_lines;
CREATE TRIGGER trg_enforce_fiscal_period_lock_lines
BEFORE INSERT OR UPDATE OR DELETE ON public.gl_journal_lines
FOR EACH ROW EXECUTE FUNCTION public.enforce_fiscal_period_lock_lines();

-- Protect the fiscal period row itself: cannot delete a closed/locked period
CREATE OR REPLACE FUNCTION public.protect_closed_fiscal_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('closed','locked') THEN
      RAISE EXCEPTION 'Cannot delete a % fiscal period (%).', OLD.status, OLD.period_name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_closed_fiscal_period ON public.gl_fiscal_periods;
CREATE TRIGGER trg_protect_closed_fiscal_period
BEFORE DELETE ON public.gl_fiscal_periods
FOR EACH ROW EXECUTE FUNCTION public.protect_closed_fiscal_period();

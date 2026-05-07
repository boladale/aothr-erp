-- 1. Extend salary_components
ALTER TABLE public.salary_components
  ADD COLUMN IF NOT EXISTS calculation_type text NOT NULL DEFAULT 'percentage' CHECK (calculation_type IN ('percentage','fixed')),
  ADD COLUMN IF NOT EXISTS default_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_basis text NOT NULL DEFAULT 'basic' CHECK (calculation_basis IN ('basic','gross','fixed'));

-- Helper: HR/payroll/admin check
CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'hr_manager')
      OR public.has_role(auth.uid(),'hr_officer')
      OR public.has_role(auth.uid(),'payroll_manager');
$$;

-- 2. pay_grade_components
CREATE TABLE IF NOT EXISTS public.pay_grade_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_grade_id uuid NOT NULL REFERENCES public.pay_grades(id) ON DELETE CASCADE,
  salary_component_id uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE RESTRICT,
  rate numeric NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pay_grade_id, salary_component_id)
);
ALTER TABLE public.pay_grade_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR manage pay grade components" ON public.pay_grade_components FOR ALL
USING (organization_id = public.get_user_org_id() AND public.is_hr_or_admin())
WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_or_admin());

CREATE POLICY "Org view pay grade components" ON public.pay_grade_components FOR SELECT
USING (organization_id = public.get_user_org_id());

CREATE TRIGGER pgc_set_org BEFORE INSERT ON public.pay_grade_components
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();
CREATE TRIGGER pgc_updated_at BEFORE UPDATE ON public.pay_grade_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. employees.pay_grade_id
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pay_grade_id uuid REFERENCES public.pay_grades(id) ON DELETE SET NULL;

-- 4. employee_salary_lines
CREATE TABLE IF NOT EXISTS public.employee_salary_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_salary_id uuid NOT NULL REFERENCES public.employee_salary(id) ON DELETE CASCADE,
  salary_component_id uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE RESTRICT,
  amount numeric NOT NULL DEFAULT 0,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_salary_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR manage salary lines" ON public.employee_salary_lines FOR ALL
USING (organization_id = public.get_user_org_id() AND public.is_hr_or_admin())
WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_or_admin());

CREATE POLICY "View own salary lines" ON public.employee_salary_lines FOR SELECT
USING (
  organization_id = public.get_user_org_id() AND (
    public.is_hr_or_admin() OR EXISTS (
      SELECT 1 FROM employee_salary es
      JOIN employees e ON e.id = es.employee_id
      WHERE es.id = employee_salary_lines.employee_salary_id AND e.user_id = auth.uid()
    )
  )
);

CREATE TRIGGER esl_set_org BEFORE INSERT ON public.employee_salary_lines
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

-- 5. Add pay_grade_id column to employee_salary if missing
ALTER TABLE public.employee_salary
  ADD COLUMN IF NOT EXISTS pay_grade_id uuid REFERENCES public.pay_grades(id) ON DELETE SET NULL;

-- 6. Generation function
CREATE OR REPLACE FUNCTION public.generate_employee_salary_from_grade(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_grade_id uuid; v_basic numeric; v_org uuid; v_salary_id uuid;
  v_gross numeric := 0; v_deductions numeric := 0;
  r RECORD; v_amount numeric;
BEGIN
  SELECT pay_grade_id, organization_id INTO v_grade_id, v_org FROM employees WHERE id = p_employee_id;
  IF v_grade_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(basic_salary,0) INTO v_basic FROM pay_grades WHERE id = v_grade_id;

  UPDATE employee_salary SET is_current = false WHERE employee_id = p_employee_id AND is_current = true;

  INSERT INTO employee_salary (employee_id, pay_grade_id, basic_salary, gross_salary, net_salary, effective_date, is_current, organization_id)
  VALUES (p_employee_id, v_grade_id, v_basic, 0, 0, CURRENT_DATE, true, v_org)
  RETURNING id INTO v_salary_id;

  FOR r IN
    SELECT pgc.rate, sc.id AS comp_id, sc.component_type, sc.calculation_type
    FROM pay_grade_components pgc
    JOIN salary_components sc ON sc.id = pgc.salary_component_id
    WHERE pgc.pay_grade_id = v_grade_id
  LOOP
    IF r.calculation_type = 'percentage' THEN
      v_amount := ROUND(v_basic * r.rate / 100.0, 2);
    ELSE
      v_amount := r.rate;
    END IF;

    INSERT INTO employee_salary_lines (employee_salary_id, salary_component_id, amount, organization_id)
    VALUES (v_salary_id, r.comp_id, v_amount, v_org);

    IF r.component_type = 'earning' THEN v_gross := v_gross + v_amount;
    ELSE v_deductions := v_deductions + v_amount; END IF;
  END LOOP;

  UPDATE employee_salary SET gross_salary = v_gross, net_salary = v_gross - v_deductions WHERE id = v_salary_id;
END;
$$;

-- 7. Trigger on employee grade change
CREATE OR REPLACE FUNCTION public.on_employee_grade_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pay_grade_id IS NOT NULL AND NEW.pay_grade_id IS DISTINCT FROM COALESCE(OLD.pay_grade_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public.generate_employee_salary_from_grade(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_grade_change ON public.employees;
CREATE TRIGGER trg_employee_grade_change
AFTER INSERT OR UPDATE OF pay_grade_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.on_employee_grade_change();
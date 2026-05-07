
CREATE OR REPLACE FUNCTION public.is_hr_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','hr_manager','hr_officer','payroll_manager')
  );
$$;

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  employee_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  date_of_birth date,
  gender text,
  marital_status text,
  address text,
  city text,
  state text,
  country text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_role_id uuid REFERENCES public.job_roles(id) ON DELETE SET NULL,
  employment_type text NOT NULL DEFAULT 'full_time',
  employment_date date NOT NULL DEFAULT CURRENT_DATE,
  termination_date date,
  status text NOT NULL DEFAULT 'active',
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  tax_id text,
  pension_id text,
  next_of_kin_name text,
  next_of_kin_phone text,
  next_of_kin_relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_number)
);
CREATE INDEX idx_employees_org ON public.employees(organization_id);
CREATE INDEX idx_employees_user ON public.employees(user_id);
CREATE INDEX idx_employees_dept ON public.employees(department_id);
CREATE INDEX idx_employees_role ON public.employees(job_role_id);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view employees in org" ON public.employees FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage employees" ON public.employees FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE POLICY "employee update own" ON public.employees FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_employees_set_org BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.pay_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  grade_name text NOT NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, grade_name)
);
ALTER TABLE public.pay_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view pay_grades" ON public.pay_grades FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage pay_grades" ON public.pay_grades FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_pay_grades_updated BEFORE UPDATE ON public.pay_grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pay_grades_set_org BEFORE INSERT ON public.pay_grades FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  component_type text NOT NULL DEFAULT 'earning',
  is_taxable boolean NOT NULL DEFAULT false,
  is_statutory boolean NOT NULL DEFAULT false,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view sc" ON public.salary_components FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage sc" ON public.salary_components FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_sc_updated BEFORE UPDATE ON public.salary_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sc_set_org BEFORE INSERT ON public.salary_components FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.employee_salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pay_grade_id uuid REFERENCES public.pay_grades(id) ON DELETE SET NULL,
  gross_salary numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_current boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_salary_emp ON public.employee_salary(employee_id);
ALTER TABLE public.employee_salary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view emp salary" ON public.employee_salary FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage emp salary" ON public.employee_salary FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_emp_salary_updated BEFORE UPDATE ON public.employee_salary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_emp_salary_set_org BEFORE INSERT ON public.employee_salary FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  run_number text NOT NULL,
  period_month int NOT NULL,
  period_year int NOT NULL,
  total_gross numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, run_number)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payroll_runs_set_org BEFORE INSERT ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gross_salary numeric NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  pension_employee numeric NOT NULL DEFAULT 0,
  pension_employer numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_lines_run ON public.payroll_lines(payroll_run_id);
CREATE INDEX idx_payroll_lines_emp ON public.payroll_lines(employee_id);
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view payroll lines" ON public.payroll_lines FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage payroll lines" ON public.payroll_lines FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_payroll_lines_set_org BEFORE INSERT ON public.payroll_lines FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  payroll_line_id uuid REFERENCES public.payroll_lines(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month int NOT NULL,
  period_year int NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payslips_emp ON public.payslips(employee_id);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view payslips org" ON public.payslips FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage payslips" ON public.payslips FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_payslips_set_org BEFORE INSERT ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  default_days int NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view leave types" ON public.leave_types FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage leave types" ON public.leave_types FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_lt_updated BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lt_set_org BEFORE INSERT ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_req_emp ON public.leave_requests(employee_id);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view leave req" ON public.leave_requests FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage leave req" ON public.leave_requests FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE POLICY "employee insert own leave" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id() AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE TRIGGER trg_lr_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lr_set_org BEFORE INSERT ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year int NOT NULL,
  entitled_days numeric NOT NULL DEFAULT 0,
  used_days numeric NOT NULL DEFAULT 0,
  remaining_days numeric GENERATED ALWAYS AS (entitled_days - used_days) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view leave bal" ON public.leave_balances FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage leave bal" ON public.leave_balances FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_lb_updated BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lb_set_org BEFORE INSERT ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  total_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_att_emp_date ON public.attendance_records(employee_id, date);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view attendance" ON public.attendance_records FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage attendance" ON public.attendance_records FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE TRIGGER trg_att_set_org BEFORE INSERT ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.expense_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  claim_number text NOT NULL,
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, claim_number)
);
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view expense claims" ON public.expense_claims FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id());
CREATE POLICY "hr manage expense claims" ON public.expense_claims FOR ALL TO authenticated USING (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id() AND public.is_hr_user(auth.uid()));
CREATE POLICY "emp insert own claims" ON public.expense_claims FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id() AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "emp update own claims" ON public.expense_claims FOR UPDATE TO authenticated USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())) WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ec_set_org BEFORE INSERT ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

CREATE TABLE public.expense_claim_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.expense_claims(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ecl_claim ON public.expense_claim_lines(claim_id);
ALTER TABLE public.expense_claim_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view ecl" ON public.expense_claim_lines FOR SELECT TO authenticated USING (claim_id IN (SELECT id FROM public.expense_claims WHERE organization_id = public.get_user_org_id()));
CREATE POLICY "manage ecl" ON public.expense_claim_lines FOR ALL TO authenticated USING (claim_id IN (SELECT id FROM public.expense_claims WHERE organization_id = public.get_user_org_id() AND (public.is_hr_user(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())))) WITH CHECK (claim_id IN (SELECT id FROM public.expense_claims WHERE organization_id = public.get_user_org_id() AND (public.is_hr_user(auth.uid()) OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))));

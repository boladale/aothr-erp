CREATE OR REPLACE FUNCTION public.ai_payroll_employee_detail()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE v_org uuid := public.ai_guard(ARRAY['payroll_runs']); r jsonb; v_run record;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE organization_id=v_org AND status::text NOT IN ('draft','cancelled')
    ORDER BY period_year DESC, period_month DESC LIMIT 1;
  IF v_run IS NULL THEN RETURN jsonb_build_object('summary','payroll_employee_detail','note','No approved payroll run found.'); END IF;
  SELECT jsonb_build_object('summary','payroll_employee_detail','as_of',now(),
    'payroll_run',v_run.run_number,'period',v_run.period_year||'-'||lpad(v_run.period_month::text,2,'0'),
    'employees',coalesce(jsonb_agg(jsonb_build_object(
      'employee_number',e.employee_number,'name',e.first_name||' '||e.last_name,'department',d.name,'job_role',j.title,
      'monthly_gross',pl.gross_salary,'tax',pl.tax_amount,'pension_employee',pl.pension_employee,
      'total_deductions',pl.total_deductions,'net_pay',pl.net_salary) ORDER BY pl.gross_salary DESC),'[]'))
  INTO r
  FROM payroll_lines pl JOIN employees e ON e.id=pl.employee_id
  LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN job_roles j ON j.id=e.job_role_id
  WHERE pl.payroll_run_id=v_run.id;
  RETURN r;
END $f$;
REVOKE ALL ON FUNCTION public.ai_payroll_employee_detail() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_payroll_employee_detail() TO authenticated;
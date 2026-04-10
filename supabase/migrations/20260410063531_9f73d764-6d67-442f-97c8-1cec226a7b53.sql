
INSERT INTO public.permissions (code, description) VALUES
  ('departments', 'Departments'),
  ('employees', 'Employees'),
  ('leave_management', 'Leave Management'),
  ('attendance', 'Attendance'),
  ('salary_components', 'Salary Components'),
  ('pay_grades', 'Pay Grades'),
  ('payroll_runs', 'Payroll Runs'),
  ('payslips', 'Payslips'),
  ('self_service', 'Staff Self Service'),
  ('vendor_portal', 'Vendor Portal'),
  ('hr_dashboard', 'HR Dashboard'),
  ('expense_claims', 'Expense Claims')
ON CONFLICT DO NOTHING;

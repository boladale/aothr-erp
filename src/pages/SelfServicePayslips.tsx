import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SelfServicePayslips() {
  const { user } = useAuth();

  const { data: employee } = useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => { const { data } = await supabase.from('employees' as any).select('id').eq('user_id', user!.id).maybeSingle(); return data; },
    enabled: !!user,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ['my-payslips', employee?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payslips' as any).select('*, payroll_lines(gross_salary, total_deductions, net_salary)').eq('employee_id', (employee as any).id).order('period_year', { ascending: false }).order('period_month', { ascending: false });
      return data || [];
    },
    enabled: !!employee,
  });

  if (!employee) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">No employee record linked to your account.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="My Payslips" description="View your payslip history" />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payslip #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payslips available</TableCell></TableRow>
              ) : payslips.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.payslip_number}</TableCell>
                  <TableCell>{MONTHS[p.period_month - 1]} {p.period_year}</TableCell>
                  <TableCell>{Number(p.payroll_lines?.gross_salary || 0).toLocaleString()}</TableCell>
                  <TableCell>{Number(p.payroll_lines?.total_deductions || 0).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">{Number(p.payroll_lines?.net_salary || 0).toLocaleString()}</TableCell>
                  <TableCell>{format(new Date(p.generated_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

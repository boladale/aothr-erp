import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Payslips() {
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['payslips'],
    queryFn: async () => {
      const { data } = await supabase.from('payslips' as any).select('*, employees(first_name, last_name, employee_number), payroll_lines(gross_salary, net_salary, total_deductions)').order('period_year', { ascending: false }).order('period_month', { ascending: false });
      return data || [];
    },
  });

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Payslips" description="View all generated payslips" />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payslip #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : payslips.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payslips generated yet. Approve a payroll run to generate payslips.</TableCell></TableRow>
              ) : payslips.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.payslip_number}</TableCell>
                  <TableCell>{p.employees?.first_name} {p.employees?.last_name}</TableCell>
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

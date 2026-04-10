import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollRunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: run } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: async () => { const { data } = await supabase.from('payroll_runs').select('*').eq('id', id).single(); return data; },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['payroll-lines', id],
    queryFn: async () => {
      const { data } = await supabase.from('payroll_lines').select('*, employees(first_name, last_name, employee_number)').eq('payroll_run_id', id!).order('created_at');
      return data || [];
    },
    enabled: !!id,
  });

  if (!run) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/payroll-runs')}><ArrowLeft className="h-4 w-4" /></Button>
          <PageHeader title={`Payroll: ${run.run_number}`} description={`${MONTHS[run.period_month - 1]} ${run.period_year}`} />
          <div className="ml-auto"><StatusBadge status={run.status} /></div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Total Gross</p><p className="text-2xl font-bold">{Number(run.total_gross).toLocaleString()}</p></div>
          <div className="rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Total Deductions</p><p className="text-2xl font-bold">{Number(run.total_deductions).toLocaleString()}</p></div>
          <div className="rounded-lg border p-4 text-center"><p className="text-sm text-muted-foreground">Total Net</p><p className="text-2xl font-bold text-primary">{Number(run.total_net).toLocaleString()}</p></div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Pension (Emp)</TableHead>
                <TableHead>Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payroll lines</TableCell></TableRow>
              ) : lines.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.employees?.employee_number}</TableCell>
                  <TableCell>{l.employees?.first_name} {l.employees?.last_name}</TableCell>
                  <TableCell>{Number(l.gross_salary).toLocaleString()}</TableCell>
                  <TableCell>{Number(l.total_earnings).toLocaleString()}</TableCell>
                  <TableCell>{Number(l.total_deductions).toLocaleString()}</TableCell>
                  <TableCell>{Number(l.tax_amount).toLocaleString()}</TableCell>
                  <TableCell>{Number(l.pension_employee).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">{Number(l.net_salary).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Play, Check, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollRuns() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ period_month: (now.getMonth() + 1).toString(), period_year: now.getFullYear().toString(), notes: '' });

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => { const { data } = await supabase.from('payroll_runs').select('*').order('period_year', { ascending: false }).order('period_month', { ascending: false }); return data || []; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const month = parseInt(form.period_month);
      const year = parseInt(form.period_year);
      const runNumber = `PR-${year}-${String(month).padStart(2, '0')}`;

      // Get all active employees with current salary
      const { data: empSalaries, error: empErr } = await supabase
        .from('employee_salary')
        .select('*, employees(id, first_name, last_name, status)')
        .eq('is_current', true);
      if (empErr) throw empErr;

      const activeEmps = (empSalaries || []).filter((es: any) => es.employees?.status === 'active');

      // Create the run
      const totalGross = activeEmps.reduce((sum: number, es: any) => sum + Number(es.gross_salary), 0);
      const totalNet = activeEmps.reduce((sum: number, es: any) => sum + Number(es.net_salary), 0);
      const totalDeductions = totalGross - totalNet;

      const { data: run, error: runErr } = await supabase.from('payroll_runs').insert({
        run_number: runNumber,
        period_month: month,
        period_year: year,
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        notes: form.notes || null,
        created_by: user?.id,
        organization_id: organizationId,
      }).select().single();
      if (runErr) throw runErr;

      // Create payroll lines for each employee
      const lines = activeEmps.map((es: any) => ({
        payroll_run_id: run.id,
        employee_id: es.employee_id,
        gross_salary: es.gross_salary,
        total_earnings: es.gross_salary,
        total_deductions: Number(es.gross_salary) - Number(es.net_salary),
        net_salary: es.net_salary,
        tax_amount: 0,
        pension_employee: 0,
        pension_employer: 0,
      }));

      if (lines.length > 0) {
        const { error: lineErr } = await supabase.from('payroll_lines').insert(lines);
        if (lineErr) throw lineErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setOpen(false);
      toast.success('Payroll run created with employee lines');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payroll_runs').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id).eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast.success('Payroll approved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Payroll Runs" description="Process monthly payroll">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Payroll Run</Button>
        </PageHeader>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : runs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payroll runs</TableCell></TableRow>
              ) : runs.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.run_number}</TableCell>
                  <TableCell>{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                  <TableCell>{Number(r.total_gross).toLocaleString()}</TableCell>
                  <TableCell>{Number(r.total_deductions).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">{Number(r.total_net).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/payroll-runs/${r.id}`)}><Eye className="h-4 w-4" /></Button>
                    {r.status === 'draft' && (
                      <Button size="sm" variant="default" onClick={() => approveMutation.mutate(r.id)}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Payroll Run</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Month</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div><Label>Year</Label><Input value={form.period_year} onChange={e => setForm(f => ({ ...f, period_year: e.target.value }))} type="number" /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <p className="text-sm text-muted-foreground">This will generate payroll lines for all active employees with current salary assignments.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Processing...' : 'Generate Payroll'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, PiggyBank } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function Budgets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canCreate = hasRole('admin') || hasRole('accounts_payable');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', fiscal_year: new Date().getFullYear() });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('budgets')
        .select('id, name, fiscal_year, status, budget_code, lines:budget_lines(annual_amount, committed_amount, actual_amount)')
        .order('fiscal_year', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((b: any) => {
        const total = (b.lines || []).reduce((s: number, l: any) => s + Number(l.annual_amount || 0), 0);
        const committed = (b.lines || []).reduce((s: number, l: any) => s + Number(l.committed_amount || 0), 0);
        const actual = (b.lines || []).reduce((s: number, l: any) => s + Number(l.actual_amount || 0), 0);
        return { ...b, total, committed, actual, variance: total - committed - actual };
      });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const code = `BUD-${form.fiscal_year}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
      const { data, error } = await supabase.from('budgets').insert({
        name: form.name,
        fiscal_year: form.fiscal_year,
        budget_code: code,
        start_date: `${form.fiscal_year}-01-01`,
        end_date: `${form.fiscal_year}-12-31`,
        status: 'draft',
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (b: any) => {
      toast({ title: 'Budget created' });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      setCreateOpen(false);
      setForm({ name: '', fiscal_year: new Date().getFullYear() });
      navigate(`/budgets/${b.id}`);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader
          title="Budgets"
          description="Annual budgets with departmental and account-level allocations."
          actions={
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                </SelectContent>
              </Select>
              {canCreate && (
                <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Budget</Button>
              )}
            </div>
          }
        />

        <Card>
          {isLoading ? (
            <div className="p-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : budgets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No budgets found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Budget</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b: any) => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/budgets/${b.id}`)}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.fiscal_year}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right">{formatCurrency(b.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.committed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.actual)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.variance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Budget Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="FY 2026 Operating Budget" />
            </div>
            <div>
              <Label>Fiscal Year</Label>
              <Input type="number" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

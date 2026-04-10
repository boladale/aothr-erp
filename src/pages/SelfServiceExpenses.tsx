import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function SelfServiceExpenses() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', lines: [{ description: '', amount: '', category: '', expense_date: new Date().toISOString().split('T')[0] }] });

  const { data: employee } = useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => { const { data } = await supabase.from('employees').select('id').eq('user_id', user!.id).maybeSingle(); return data; },
    enabled: !!user,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['my-expense-claims', employee?.id],
    queryFn: async () => {
      const { data } = await supabase.from('expense_claims').select('*').eq('employee_id', employee!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = form.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      const claimNumber = `EXP-${Date.now().toString(36).toUpperCase()}`;
      const { data: claim, error: claimErr } = await supabase.from('expense_claims').insert({
        employee_id: employee!.id,
        claim_number: claimNumber,
        description: form.description,
        total_amount: totalAmount,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        organization_id: organizationId,
      }).select().single();
      if (claimErr) throw claimErr;

      const lines = form.lines.filter(l => l.description && l.amount).map(l => ({
        claim_id: claim.id,
        description: l.description,
        amount: parseFloat(l.amount),
        category: l.category || null,
        expense_date: l.expense_date,
      }));
      if (lines.length > 0) {
        const { error } = await supabase.from('expense_claim_lines').insert(lines);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-expense-claims'] });
      setOpen(false);
      setForm({ description: '', lines: [{ description: '', amount: '', category: '', expense_date: new Date().toISOString().split('T')[0] }] });
      toast.success('Expense claim submitted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { description: '', amount: '', category: '', expense_date: new Date().toISOString().split('T')[0] }] }));
  const updateLine = (i: number, k: string, v: string) => setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }));

  if (!employee) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">No employee record linked to your account.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="My Expense Claims" description="Submit and track expense reimbursements">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Claim</Button>
        </PageHeader>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expense claims</TableCell></TableRow>
              ) : claims.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.claim_number}</TableCell>
                  <TableCell>{c.description || '—'}</TableCell>
                  <TableCell>{Number(c.total_amount).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>{c.submitted_at ? format(new Date(c.submitted_at), 'dd MMM yyyy') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Expense Claim</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Trip to Lagos for client meeting" /></div>
              <div className="space-y-2">
                <Label>Expense Items</Label>
                {form.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <Input placeholder="Description" value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                    <Input placeholder="Amount" type="number" value={l.amount} onChange={e => updateLine(i, 'amount', e.target.value)} />
                    <Input placeholder="Category" value={l.category} onChange={e => updateLine(i, 'category', e.target.value)} />
                    <Input type="date" value={l.expense_date} onChange={e => updateLine(i, 'expense_date', e.target.value)} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLine}>+ Add Item</Button>
              </div>
              <div className="text-right font-semibold">
                Total: {form.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toLocaleString()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <Send className="h-4 w-4 mr-2" /> Submit Claim
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export default function SalaryComponents() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', component_type: 'earning' as string, calculation_type: 'percentage' as string, default_rate: '', is_taxable: false, is_statutory: false, description: '' });

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['salary-components'],
    queryFn: async () => { const { data } = await supabase.from('salary_components' as any).select('*').order('component_type', { ascending: true }).order('name'); return data || []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        component_type: form.component_type,
        calculation_type: form.calculation_type,
        default_rate: parseFloat(form.default_rate) || 0,
        is_taxable: form.is_taxable,
        is_statutory: form.is_statutory,
        description: form.description || null,
        organization_id: organizationId,
      };
      const { error } = await supabase.from('salary_components' as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-components'] });
      setOpen(false);
      setForm({ name: '', component_type: 'earning', calculation_type: 'percentage', default_rate: '', is_taxable: false, is_statutory: false, description: '' });
      toast.success('Salary component created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Salary Components" description="Configure earnings and deductions for payroll" actions={<><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Component</Button></>} />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Calc</TableHead>
                <TableHead>Default Rate</TableHead>
                <TableHead>Taxable</TableHead>
                <TableHead>Statutory</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : components.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant={c.component_type === 'earning' ? 'default' : 'destructive'}>{c.component_type}</Badge></TableCell>
                  <TableCell>{c.calculation_type}</TableCell>
                  <TableCell>{c.default_rate}{c.calculation_type === 'percentage' ? '%' : ''}</TableCell>
                  <TableCell>{c.is_taxable ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{c.is_statutory ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Salary Component</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Basic Salary" /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.component_type} onValueChange={v => setForm(f => ({ ...f, component_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Calculation Type</Label>
                  <Select value={form.calculation_type} onValueChange={v => setForm(f => ({ ...f, calculation_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">% of Basic</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Default Rate</Label><Input type="number" value={form.default_rate} onChange={e => setForm(f => ({ ...f, default_rate: e.target.value }))} placeholder={form.calculation_type === 'percentage' ? 'e.g. 30' : 'e.g. 50000'} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_taxable} onChange={e => setForm(f => ({ ...f, is_taxable: e.target.checked }))} className="rounded" /> Taxable</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_statutory} onChange={e => setForm(f => ({ ...f, is_statutory: e.target.checked }))} className="rounded" /> Statutory</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

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
import { Plus, Settings, Trash2 } from 'lucide-react';

export default function PayGrades() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ grade_name: '', basic_salary: '', description: '' });
  const [activeGrade, setActiveGrade] = useState<any>(null);
  const [newComp, setNewComp] = useState({ salary_component_id: '', rate: '' });

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['pay-grades'],
    queryFn: async () => { const { data } = await supabase.from('pay_grades' as any).select('*').order('grade_name'); return data || []; },
  });

  const { data: components = [] } = useQuery({
    queryKey: ['salary-components-all'],
    queryFn: async () => { const { data } = await supabase.from('salary_components' as any).select('*').order('component_type').order('name'); return (data || []) as any[]; },
  });

  const { data: gradeComps = [], refetch: refetchGC } = useQuery({
    queryKey: ['pay-grade-components', activeGrade?.id],
    queryFn: async () => {
      if (!activeGrade) return [];
      const { data } = await supabase.from('pay_grade_components' as any).select('*, salary_components(name, component_type, calculation_type)').eq('pay_grade_id', activeGrade.id);
      return (data || []) as any[];
    },
    enabled: !!activeGrade,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pay_grades' as any).insert({
        grade_name: form.grade_name,
        basic_salary: parseFloat(form.basic_salary) || 0,
        description: form.description || null,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-grades'] });
      setOpen(false);
      setForm({ grade_name: '', basic_salary: '', description: '' });
      toast.success('Pay grade created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addComp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pay_grade_components' as any).insert({
        pay_grade_id: activeGrade.id,
        salary_component_id: newComp.salary_component_id,
        rate: parseFloat(newComp.rate) || 0,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewComp({ salary_component_id: '', rate: '' }); refetchGC(); toast.success('Component added'); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeComp = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('pay_grade_components' as any).delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { refetchGC(); toast.success('Removed'); },
  });

  const basic = Number(activeGrade?.basic_salary || 0);
  const earnings = gradeComps.filter((c: any) => c.salary_components?.component_type === 'earning');
  const deductions = gradeComps.filter((c: any) => c.salary_components?.component_type === 'deduction');
  const calcAmt = (c: any) => c.salary_components?.calculation_type === 'percentage' ? basic * Number(c.rate) / 100 : Number(c.rate);
  const totalEarnings = earnings.reduce((s, c) => s + calcAmt(c), 0);
  const totalDeductions = deductions.reduce((s, c) => s + calcAmt(c), 0);
  const gross = basic + earnings.filter((c: any) => c.salary_components?.name?.toLowerCase() !== 'basic salary').reduce((s, c) => s + calcAmt(c), 0);

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Pay Grades" description="Define salary grades and link earnings/deductions" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Pay Grade</Button>} />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : grades.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.grade_name}</TableCell>
                  <TableCell>₦{Number(g.basic_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{g.description || '—'}</TableCell>
                  <TableCell>{g.is_active ? '✓ Active' : 'Inactive'}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => setActiveGrade(g)}><Settings className="h-4 w-4 mr-1" /> Components</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Pay Grade</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Grade Name</Label><Input value={form.grade_name} onChange={e => setForm(f => ({ ...f, grade_name: e.target.value }))} placeholder="e.g. Grade 1" /></div>
              <div><Label>Basic Salary (₦)</Label><Input value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} type="number" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.grade_name || saveMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!activeGrade} onOpenChange={(o) => !o && setActiveGrade(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Components — {activeGrade?.grade_name}</DialogTitle>
              <p className="text-sm text-muted-foreground">Basic Salary: ₦{basic.toLocaleString()}. Percentage components calculate against basic.</p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-end gap-2 p-3 border rounded-md bg-muted/30">
                <div className="flex-1">
                  <Label>Component</Label>
                  <Select value={newComp.salary_component_id} onValueChange={v => setNewComp(c => ({ ...c, salary_component_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select component" /></SelectTrigger>
                    <SelectContent>
                      {components.filter((c: any) => !gradeComps.find((gc: any) => gc.salary_component_id === c.id)).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.component_type}, {c.calculation_type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label>Rate</Label>
                  <Input type="number" value={newComp.rate} onChange={e => setNewComp(c => ({ ...c, rate: e.target.value }))} placeholder="%" />
                </div>
                <Button onClick={() => addComp.mutate()} disabled={!newComp.salary_component_id || !newComp.rate}>Add</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calc</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount (₦)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradeComps.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No components linked</TableCell></TableRow>
                  ) : gradeComps.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.salary_components?.name}</TableCell>
                      <TableCell><Badge variant={c.salary_components?.component_type === 'earning' ? 'default' : 'destructive'}>{c.salary_components?.component_type}</Badge></TableCell>
                      <TableCell>{c.salary_components?.calculation_type}</TableCell>
                      <TableCell>{c.rate}{c.salary_components?.calculation_type === 'percentage' ? '%' : ''}</TableCell>
                      <TableCell>{calcAmt(c).toLocaleString()}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeComp.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t text-sm">
                <div><div className="text-muted-foreground">Total Earnings</div><div className="font-semibold">₦{totalEarnings.toLocaleString()}</div></div>
                <div><div className="text-muted-foreground">Total Deductions</div><div className="font-semibold">₦{totalDeductions.toLocaleString()}</div></div>
                <div><div className="text-muted-foreground">Estimated Net</div><div className="font-semibold">₦{(totalEarnings - totalDeductions).toLocaleString()}</div></div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

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
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export default function PayGrades() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ grade_name: '', basic_salary: '', description: '' });

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['pay-grades'],
    queryFn: async () => { const { data } = await supabase.from('pay_grades' as any).select('*').order('grade_name'); return data || []; },
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

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Pay Grades" description="Define salary grades and structures" actions={<><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Pay Grade</Button></>} />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : grades.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.grade_name}</TableCell>
                  <TableCell>{Number(g.basic_salary).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{g.description || '—'}</TableCell>
                  <TableCell>{g.is_active ? '✓ Active' : 'Inactive'}</TableCell>
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
              <div><Label>Basic Salary</Label><Input value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} type="number" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.grade_name || saveMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

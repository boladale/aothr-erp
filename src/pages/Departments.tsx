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
import { Plus, Edit } from 'lucide-react';

export default function Departments() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '' });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments' as any).select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('departments' as any).update({ name: form.name, code: form.code }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('departments' as any).insert({ name: form.name, code: form.code, organization_id: organizationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setOpen(false);
      setEditing(null);
      setForm({ name: '', code: '' });
      toast.success(editing ? 'Department updated' : 'Department created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (dept: any) => {
    setEditing(dept);
    setForm({ name: dept.name, code: dept.code });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Departments" description="Manage organizational departments" actions={<><Button onClick={() => { setEditing(null); setForm({ name: '', code: '' }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Department
          </Button></>} />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : departments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No departments found</TableCell></TableRow>
              ) : departments.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><StatusBadge status={d.is_active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Department</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. FIN" /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Finance" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.code || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Power } from 'lucide-react';

export default function Services() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; code: string; description: string; estimated_cost: string; is_active: boolean }>({ name: '', code: '', description: '', estimated_cost: '', is_active: true });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services' as any).select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        estimated_cost: form.estimated_cost === '' ? null : parseFloat(form.estimated_cost),
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('services' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services' as any).insert({ ...payload, organization_id: organizationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setOpen(false);
      setEditing(null);
      setForm({ name: '', code: '', description: '', estimated_cost: '', is_active: true });
      toast.success(editing ? 'Service updated' : 'Service created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (svc: any) => {
      const { error } = await supabase.from('services' as any).update({ is_active: !svc.is_active }).eq('id', svc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (svc: any) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      code: svc.code,
      description: svc.description || '',
      estimated_cost: svc.estimated_cost == null ? '' : String(svc.estimated_cost),
      is_active: svc.is_active ?? true,
    });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader
          title="Services"
          description="Manage services that can be requisitioned"
          actions={
            <Button onClick={() => { setEditing(null); setForm({ name: '', code: '', description: '', estimated_cost: '', is_active: true }); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Service
            </Button>
          }
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : services.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No services found</TableCell></TableRow>
              ) : services.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.description || '-'}</TableCell>
                  <TableCell className="text-right">₦{Number(s.estimated_cost || 0).toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={s.is_active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate(s)} title={s.is_active ? 'Deactivate' : 'Activate'} disabled={toggleActiveMutation.isPending}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Service</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. SVC-001" /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Office Cleaning" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
              <div>
                <Label>Estimated Cost <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="number" step="0.01" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} placeholder="Leave blank if not applicable" />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive services are hidden from selection.</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              </div>
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

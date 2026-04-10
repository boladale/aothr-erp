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
import { Plus } from 'lucide-react';
import { format, differenceInBusinessDays } from 'date-fns';

export default function SelfServiceLeave() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });

  const { data: employee } = useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => { const { data } = await supabase.from('employees' as any).select('id').eq('user_id', user!.id).maybeSingle(); return data; },
    enabled: !!user,
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => { const { data } = await supabase.from('leave_types' as any).select('*').eq('is_active', true).order('name'); return data || []; },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['my-leave-requests', employee?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leave_requests' as any).select('*, leave_types(name)').eq('employee_id', employee!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!employee,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const days = differenceInBusinessDays(new Date(form.end_date), new Date(form.start_date)) + 1;
      const { error } = await supabase.from('leave_requests' as any).insert({
        employee_id: employee!.id,
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        days_requested: Math.max(1, days),
        reason: form.reason || null,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      setOpen(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      toast.success('Leave request submitted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!employee) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">No employee record linked to your account.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="My Leave" description="Request and track leave" actions={<><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Request Leave</Button></>} />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leave requests</TableCell></TableRow>
              ) : requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.leave_types?.name}</TableCell>
                  <TableCell>{format(new Date(r.start_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{format(new Date(r.end_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{r.days_requested}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Leave Type</Label>
                <Select value={form.leave_type_id} onValueChange={v => setForm(f => ({ ...f, leave_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{leaveTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => submitMutation.mutate()} disabled={!form.leave_type_id || !form.start_date || !form.end_date || submitMutation.isPending}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

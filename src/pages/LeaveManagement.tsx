import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Check, X } from 'lucide-react';
import { format } from 'date-fns';

export default function LeaveManagement() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', default_days: '20', is_paid: true });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => { const { data } = await supabase.from('leave_types').select('*').order('name'); return data || []; },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['all-leave-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('leave_requests').select('*, employees(first_name, last_name, employee_number), leave_types(name)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const saveTypeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leave_types').insert({
        name: typeForm.name,
        default_days: parseInt(typeForm.default_days),
        is_paid: typeForm.is_paid,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setTypeOpen(false);
      setTypeForm({ name: '', default_days: '20', is_paid: true });
      toast.success('Leave type created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('leave_requests').update({
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;

      if (status === 'approved') {
        const req = leaveRequests.find((r: any) => r.id === id) as any;
        if (req) {
          await supabase.from('leave_balances')
            .update({ used_days: supabase.rpc ? undefined : 0 })
            .eq('employee_id', req.employee_id)
            .eq('leave_type_id', req.leave_type_id)
            .eq('year', new Date().getFullYear());
          // Increment used_days
          const { data: balance } = await supabase.from('leave_balances')
            .select('id, used_days')
            .eq('employee_id', req.employee_id)
            .eq('leave_type_id', req.leave_type_id)
            .eq('year', new Date().getFullYear())
            .maybeSingle();
          if (balance) {
            await supabase.from('leave_balances').update({
              used_days: Number(balance.used_days) + Number(req.days_requested),
            }).eq('id', balance.id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
      toast.success('Leave request updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pending = leaveRequests.filter((r: any) => r.status === 'pending');
  const processed = leaveRequests.filter((r: any) => r.status !== 'pending');

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Leave Management" description="Manage leave types and process leave requests">
          <Button onClick={() => setTypeOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Leave Type</Button>
        </PageHeader>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="processed">Processed</TabsTrigger>
            <TabsTrigger value="types">Leave Types</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pending requests</TableCell></TableRow>
                  ) : pending.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employees?.first_name} {r.employees?.last_name}</TableCell>
                      <TableCell>{r.leave_types?.name}</TableCell>
                      <TableCell>{format(new Date(r.start_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(new Date(r.end_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{r.days_requested}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="default" onClick={() => actionMutation.mutate({ id: r.id, status: 'approved' })}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate({ id: r.id, status: 'rejected' })}><X className="h-4 w-4 mr-1" /> Reject</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="processed">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No processed requests</TableCell></TableRow>
                  ) : processed.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employees?.first_name} {r.employees?.last_name}</TableCell>
                      <TableCell>{r.leave_types?.name}</TableCell>
                      <TableCell>{format(new Date(r.start_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(new Date(r.end_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{r.days_requested}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="types">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Default Days</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveTypes.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.default_days}</TableCell>
                      <TableCell>{t.is_paid ? 'Yes' : 'No'}</TableCell>
                      <TableCell><StatusBadge status={t.is_active ? 'active' : 'inactive'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Leave Type</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Annual Leave" /></div>
              <div><Label>Default Days</Label><Input value={typeForm.default_days} onChange={e => setTypeForm(f => ({ ...f, default_days: e.target.value }))} type="number" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={typeForm.is_paid} onChange={e => setTypeForm(f => ({ ...f, is_paid: e.target.checked }))} className="rounded" />
                <Label>Paid Leave</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTypeOpen(false)}>Cancel</Button>
              <Button onClick={() => saveTypeMutation.mutate()} disabled={!typeForm.name || saveTypeMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

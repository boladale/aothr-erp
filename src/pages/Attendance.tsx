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
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Attendance() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: new Date().toISOString().split('T')[0], clock_in: '08:00', clock_out: '17:00', notes: '' });
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', dateFilter],
    queryFn: async () => {
      const { data } = await supabase.from('attendance_records').select('*, employees(first_name, last_name, employee_number)').eq('date', dateFilter).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => { const { data } = await supabase.from('employees').select('id, first_name, last_name, employee_number').eq('status', 'active').order('first_name'); return data || []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const clockIn = new Date(`${form.date}T${form.clock_in}:00`);
      const clockOut = new Date(`${form.date}T${form.clock_out}:00`);
      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const { error } = await supabase.from('attendance_records').insert({
        employee_id: form.employee_id,
        date: form.date,
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        total_hours: Math.max(0, totalHours),
        notes: form.notes || null,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setOpen(false);
      toast.success('Attendance recorded');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Attendance" description="Track employee attendance">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Record Attendance</Button>
        </PageHeader>

        <div className="flex items-center gap-2">
          <Label>Date</Label>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records for this date</TableCell></TableRow>
              ) : records.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.employees?.first_name} {r.employees?.last_name}</TableCell>
                  <TableCell>{r.clock_in ? format(new Date(r.clock_in), 'HH:mm') : '—'}</TableCell>
                  <TableCell>{r.clock_out ? format(new Date(r.clock_out), 'HH:mm') : '—'}</TableCell>
                  <TableCell>{r.total_hours ? Number(r.total_hours).toFixed(1) : '—'}</TableCell>
                  <TableCell>{r.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Attendance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_number})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Clock In</Label><Input type="time" value={form.clock_in} onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} /></div>
                <div><Label>Clock Out</Label><Input type="time" value={form.clock_out} onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.employee_id || saveMutation.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

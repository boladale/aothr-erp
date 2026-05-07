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
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Eye, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const defaultForm = {
  employee_number: '', first_name: '', last_name: '', email: '', phone: '',
  department_id: '', job_role_id: '', employment_type: 'full_time' as string,
  employment_date: new Date().toISOString().split('T')[0],
  gender: '', marital_status: '',
  bank_name: '', bank_account_number: '', bank_account_name: '',
  tax_id: '', pension_id: '',
  next_of_kin_name: '', next_of_kin_phone: '', next_of_kin_relationship: '',
  address: '', city: '', state: '', country: '',
};

export default function Employees() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees' as any).select('*, departments(name), job_roles(name)').order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const { data } = await supabase.from('departments' as any).select('id, name').eq('is_active', true).order('name'); return data || []; },
  });

  const { data: jobRoles = [] } = useQuery({
    queryKey: ['job_roles_active'],
    queryFn: async () => { const { data } = await supabase.from('job_roles' as any).select('id, name').eq('is_active', true).order('name'); return (data || []) as any[]; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        organization_id: organizationId,
        department_id: form.department_id || null,
        job_role_id: form.job_role_id || null,
        gender: form.gender || null,
        marital_status: form.marital_status || null,
      };
      const { error } = await supabase.from('employees' as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setOpen(false);
      setForm(defaultForm);
      toast.success('Employee created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = employees.filter((e: any) =>
    `${e.first_name} ${e.last_name} ${e.employee_number}`.toLowerCase().includes(search.toLowerCase())
  );

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Employees" description="Manage employee records" actions={<><Button onClick={() => { setForm(defaultForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Employee
          </Button></>} />

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emp #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Job Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono">{e.employee_number}</TableCell>
                  <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                  <TableCell>{e.departments?.name || '—'}</TableCell>
                  <TableCell>{e.job_roles?.name || '—'}</TableCell>
                  <TableCell className="capitalize">{e.employment_type?.replace('_', ' ')}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/employees/${e.id}`)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Employee Number *</Label><Input value={form.employee_number} onChange={e => set('employee_number', e.target.value)} placeholder="EMP-001" /></div>
              <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
              <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => set('email', e.target.value)} type="email" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><Label>Employment Date</Label><Input value={form.employment_date} onChange={e => set('employment_date', e.target.value)} type="date" /></div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={v => set('department_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Job Role</Label>
                <Select value={form.job_role_id} onValueChange={v => set('job_role_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{jobRoles.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={form.employment_type} onValueChange={v => set('employment_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => set('gender', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select value={form.marital_status} onValueChange={v => set('marital_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => set('state', e.target.value)} /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={e => set('country', e.target.value)} /></div>
              <div className="col-span-2 border-t pt-4"><h4 className="font-semibold text-sm">Bank Details</h4></div>
              <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
              <div><Label>Account Number</Label><Input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} /></div>
              <div><Label>Account Name</Label><Input value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} /></div>
              <div><Label>Tax ID</Label><Input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} /></div>
              <div><Label>Pension ID</Label><Input value={form.pension_id} onChange={e => set('pension_id', e.target.value)} /></div>
              <div className="col-span-2 border-t pt-4"><h4 className="font-semibold text-sm">Next of Kin</h4></div>
              <div><Label>Name</Label><Input value={form.next_of_kin_name} onChange={e => set('next_of_kin_name', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={form.next_of_kin_phone} onChange={e => set('next_of_kin_phone', e.target.value)} /></div>
              <div><Label>Relationship</Label><Input value={form.next_of_kin_relationship} onChange={e => set('next_of_kin_relationship', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.employee_number || !form.first_name || !form.last_name || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Create Employee'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

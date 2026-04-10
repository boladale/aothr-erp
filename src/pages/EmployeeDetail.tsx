import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowLeft, User, Building2, Banknote, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('employees' as any).select('*, departments(name), job_titles(title)').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', id],
    queryFn: async () => {
      const { data } = await supabase.from('leave_requests' as any).select('*, leave_types(name)').eq('employee_id', id!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['leave-balances', id],
    queryFn: async () => {
      const { data } = await supabase.from('leave_balances' as any).select('*, leave_types(name)').eq('employee_id', id!).eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!id,
  });

  const { data: salary } = useQuery({
    queryKey: ['employee-salary', id],
    queryFn: async () => {
      const { data } = await supabase.from('employee_salary' as any).select('*, pay_grades(grade_name)').eq('employee_id', id!).eq('is_current', true).maybeSingle();
      return data as any;
    },
    enabled: !!id,
  });

  if (isLoading) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!employee) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">Employee not found</div></AppLayout>;

  const e = employee as any;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}><ArrowLeft className="h-4 w-4" /></Button>
          <PageHeader title={`${e.first_name} ${e.last_name}`} description={`${e.employee_number} · ${e.departments?.name || 'No department'}`} />
          <div className="ml-auto"><StatusBadge status={e.status} /></div>
        </div>

        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal"><User className="h-4 w-4 mr-1" /> Personal</TabsTrigger>
            <TabsTrigger value="employment"><Building2 className="h-4 w-4 mr-1" /> Employment</TabsTrigger>
            <TabsTrigger value="financial"><Banknote className="h-4 w-4 mr-1" /> Financial</TabsTrigger>
            <TabsTrigger value="leave"><Calendar className="h-4 w-4 mr-1" /> Leave</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{e.email || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{e.phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date of Birth</span><span>{e.date_of_birth ? format(new Date(e.date_of_birth), 'dd MMM yyyy') : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="capitalize">{e.gender || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Marital Status</span><span className="capitalize">{e.marital_status || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span>{[e.address, e.city, e.state, e.country].filter(Boolean).join(', ') || '—'}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Next of Kin</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{e.next_of_kin_name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{e.next_of_kin_phone || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Relationship</span><span>{e.next_of_kin_relationship || '—'}</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardContent className="pt-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{e.departments?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Job Title</span><span>{e.job_titles?.title || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{e.employment_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Employment Date</span><span>{format(new Date(e.employment_date), 'dd MMM yyyy')}</span></div>
                {e.termination_date && <div className="flex justify-between"><span className="text-muted-foreground">Termination Date</span><span>{format(new Date(e.termination_date), 'dd MMM yyyy')}</span></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{e.bank_name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account #</span><span>{e.bank_account_number || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span>{e.bank_account_name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax ID</span><span>{e.tax_id || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pension ID</span><span>{e.pension_id || '—'}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Current Salary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {salary ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Pay Grade</span><span>{(salary as any).pay_grades?.grade_name || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gross Salary</span><span>{Number(salary.gross_salary).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Net Salary</span><span>{Number(salary.net_salary).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Effective</span><span>{format(new Date(salary.effective_date), 'dd MMM yyyy')}</span></div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No salary assigned</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leave">
            <div className="space-y-6">
              {leaveBalances.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {leaveBalances.map((b: any) => (
                    <Card key={b.id}>
                      <CardContent className="pt-4 text-center">
                        <p className="text-sm text-muted-foreground">{b.leave_types?.name}</p>
                        <p className="text-2xl font-bold">{b.remaining_days}</p>
                        <p className="text-xs text-muted-foreground">of {b.entitled_days} days remaining</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <Card>
                <CardHeader><CardTitle className="text-base">Leave History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No leave requests</TableCell></TableRow>
                      ) : leaveRequests.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.leave_types?.name}</TableCell>
                          <TableCell>{format(new Date(l.start_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{format(new Date(l.end_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{l.days_requested}</TableCell>
                          <TableCell><StatusBadge status={l.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

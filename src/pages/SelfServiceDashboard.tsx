import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Receipt, User } from 'lucide-react';

export default function SelfServiceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: employee } = useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees').select('*, departments(name), job_titles(title)').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['my-leave-balances', employee?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leave_balances').select('*, leave_types(name)').eq('employee_id', employee!.id).eq('year', new Date().getFullYear());
      return data || [];
    },
    enabled: !!employee,
  });

  const { data: pendingLeave = 0 } = useQuery({
    queryKey: ['my-pending-leave', employee?.id],
    queryFn: async () => {
      const { count } = await supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('employee_id', employee!.id).eq('status', 'pending');
      return count || 0;
    },
    enabled: !!employee,
  });

  const { data: pendingExpenses = 0 } = useQuery({
    queryKey: ['my-pending-expenses', employee?.id],
    queryFn: async () => {
      const { count } = await supabase.from('expense_claims').select('*', { count: 'exact', head: true }).eq('employee_id', employee!.id).in('status', ['draft', 'submitted']);
      return count || 0;
    },
    enabled: !!employee,
  });

  if (!employee) {
    return (
      <AppLayout>
        <div className="page-container py-16 text-center space-y-4">
          <h2 className="text-xl font-semibold">No Employee Record Found</h2>
          <p className="text-muted-foreground">Your user account is not linked to an employee record. Please contact HR.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Self Service" description={`Welcome, ${employee.first_name} ${employee.last_name}`} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/self-service/payslips')}>
            <CardContent className="pt-6 text-center space-y-2">
              <FileText className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-semibold">My Payslips</h3>
              <p className="text-sm text-muted-foreground">View & download payslips</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/self-service/leave')}>
            <CardContent className="pt-6 text-center space-y-2">
              <Calendar className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-semibold">Leave</h3>
              <p className="text-sm text-muted-foreground">{pendingLeave} pending requests</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/self-service/expenses')}>
            <CardContent className="pt-6 text-center space-y-2">
              <Receipt className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-semibold">Expense Claims</h3>
              <p className="text-sm text-muted-foreground">{pendingExpenses} open claims</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/self-service/profile')}>
            <CardContent className="pt-6 text-center space-y-2">
              <User className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-semibold">My Profile</h3>
              <p className="text-sm text-muted-foreground">Update personal info</p>
            </CardContent>
          </Card>
        </div>

        {leaveBalances.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Leave Balances ({new Date().getFullYear()})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {leaveBalances.map((b: any) => (
                  <div key={b.id} className="text-center p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground">{b.leave_types?.name}</p>
                    <p className="text-2xl font-bold">{b.remaining_days}</p>
                    <p className="text-xs text-muted-foreground">of {b.entitled_days} remaining</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">My Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Employee #:</span> {employee.employee_number}</div>
            <div><span className="text-muted-foreground">Department:</span> {(employee as any).departments?.name || '—'}</div>
            <div><span className="text-muted-foreground">Job Title:</span> {(employee as any).job_titles?.title || '—'}</div>
            <div><span className="text-muted-foreground">Email:</span> {employee.email || '—'}</div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

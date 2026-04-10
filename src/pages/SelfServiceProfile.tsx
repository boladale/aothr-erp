import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function SelfServiceProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ phone: '', address: '', city: '', state: '', country: '', next_of_kin_name: '', next_of_kin_phone: '', next_of_kin_relationship: '', bank_name: '', bank_account_number: '', bank_account_name: '' });

  const { data: employee } = useQuery({
    queryKey: ['my-employee-full', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('employees' as any).select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        phone: employee.phone || '',
        address: employee.address || '',
        city: employee.city || '',
        state: employee.state || '',
        country: employee.country || '',
        next_of_kin_name: employee.next_of_kin_name || '',
        next_of_kin_phone: employee.next_of_kin_phone || '',
        next_of_kin_relationship: employee.next_of_kin_relationship || '',
        bank_name: employee.bank_name || '',
        bank_account_number: employee.bank_account_number || '',
        bank_account_name: employee.bank_account_name || '',
      });
    }
  }, [employee]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('employees' as any).update(form).eq('id', employee!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-employee-full'] });
      toast.success('Profile updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!employee) return <AppLayout><div className="page-container py-8 text-center text-muted-foreground">No employee record linked to your account.</div></AppLayout>;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="My Profile" description="Update your personal information" actions={<><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="h-4 w-4 mr-2" /> Save Changes</Button></>} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={e => set('state', e.target.value)} /></div>
                <div><Label>Country</Label><Input value={form.country} onChange={e => set('country', e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Next of Kin</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Name</Label><Input value={form.next_of_kin_name} onChange={e => set('next_of_kin_name', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={form.next_of_kin_phone} onChange={e => set('next_of_kin_phone', e.target.value)} /></div>
              <div><Label>Relationship</Label><Input value={form.next_of_kin_relationship} onChange={e => set('next_of_kin_relationship', e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></div>
              <div><Label>Account Number</Label><Input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} /></div>
              <div><Label>Account Name</Label><Input value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

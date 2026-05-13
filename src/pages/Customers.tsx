import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  payment_terms: number | null;
  credit_limit: number | null;
  is_active: boolean;
}

export default function Customers() {
  const { hasRole, organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', email: '', phone: '', address: '', city: '', country: '',
    payment_terms: '30', credit_limit: '0',
  });

  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('code');
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.code || !form.name) throw new Error('Code and name required');
      const { error } = await supabase.from('customers').insert({
        code: form.code, name: form.name, email: form.email || null,
        phone: form.phone || null, address: form.address || null,
        city: form.city || null, country: form.country || null,
        payment_terms: parseInt(form.payment_terms) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0, organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
      setDialogOpen(false);
      setForm({ code: '', name: '', email: '', phone: '', address: '', city: '', country: '', payment_terms: '30', credit_limit: '0' });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = customers.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Customers"
          description="Manage your customer accounts for receivables"
          actions={canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Customer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CUST-001" /></div>
                    <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
                    <div><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} /></div>
                  </div>
                  <div><Label>Credit Limit</Label><Input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} /></div>
                  <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                  <Button onClick={handleCreate} className="w-full">Create Customer</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined}
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 max-w-sm" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">City</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Terms</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Credit Limit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{c.code}</td>
                      <td className="px-4 py-2.5 text-sm font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{c.email || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{c.city || '—'}</td>
                      <td className="px-4 py-2.5 text-sm">{c.payment_terms} days</td>
                      <td className="px-4 py-2.5 text-sm">{(c.credit_limit || 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={c.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No customers found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

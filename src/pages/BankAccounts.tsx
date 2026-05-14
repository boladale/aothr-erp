import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/ui/metric-card';
import { toast } from 'sonner';
import { Plus, Landmark, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface GLAccount { id: string; account_code: string; account_name: string; }
interface BankAccount {
  id: string; account_code: string; account_name: string; bank_name: string | null;
  account_number: string | null; currency: string; gl_account_id: string | null;
  opening_balance: number; current_balance: number; is_active: boolean;
  gl_accounts?: { account_code: string; account_name: string } | null;
}

export default function BankAccounts() {
  const { hasRole, organizationId } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    account_code: '', account_name: '', bank_name: '', account_number: '',
    currency: 'USD', gl_account_id: '', opening_balance: '0',
  });

  const accountsQ = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('*, gl_accounts(account_code, account_name)').order('account_code');
      if (error) throw error;
      return (data || []) as BankAccount[];
    },
  });
  const glAccountsQ = useQuery({
    queryKey: ['gl_accounts', 'asset-postable'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name').eq('account_type', 'asset').eq('is_active', true).eq('is_header', false);
      if (error) throw error;
      return (data || []) as GLAccount[];
    },
  });
  const accounts = accountsQ.data || [];
  const glAccounts = glAccountsQ.data || [];
  const loading = accountsQ.isLoading;
  const fetchAll = () => { qc.invalidateQueries({ queryKey: ['bank_accounts'] }); qc.invalidateQueries({ queryKey: ['gl_accounts', 'asset-postable'] }); };

  const handleCreate = async () => {
    if (!form.account_code || !form.account_name) { toast.error('Code and name required'); return; }
    const opening = parseFloat(form.opening_balance) || 0;
    const { error } = await supabase.from('bank_accounts').insert({
      account_code: form.account_code, account_name: form.account_name,
      bank_name: form.bank_name || null, account_number: form.account_number || null,
      currency: form.currency, gl_account_id: form.gl_account_id || null,
      opening_balance: opening, current_balance: opening, organization_id: organizationId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Bank account created');
    setDialogOpen(false);
    setForm({ account_code: '', account_name: '', bank_name: '', account_number: '', currency: 'USD', gl_account_id: '', opening_balance: '0' });
    fetchAll();
  };

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
  const activeCount = accounts.filter(a => a.is_active).length;

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Bank Accounts"
          description="Manage bank accounts and track balances"
          actions={canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Bank Account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Account Code</Label><Input value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} placeholder="e.g. BANK-002" /></div>
                    <div><Label>Account Name</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="e.g. Payroll Account" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                    <div><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
                    <div><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} /></div>
                  </div>
                  <div>
                    <Label>Linked GL Account</Label>
                    <Select value={form.gl_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, gl_account_id: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select GL account" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {glAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} className="w-full">Create Bank Account</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard title="Total Cash Balance" value={formatCurrency(totalBalance)} icon={DollarSign} />
          <MetricCard title="Active Accounts" value={activeCount} icon={Landmark} />
          <MetricCard title="Currencies" value={[...new Set(accounts.map(a => a.currency))].length} icon={Wallet} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Bank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">GL Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Currency</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{acc.account_code}</td>
                      <td className="px-4 py-2.5 text-sm font-medium">{acc.account_name}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{acc.bank_name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground">
                        {acc.gl_accounts ? `${acc.gl_accounts.account_code} - ${acc.gl_accounts.account_name}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm">{acc.currency}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{formatCurrency(acc.current_balance)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={acc.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                          {acc.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bank accounts found</td></tr>
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

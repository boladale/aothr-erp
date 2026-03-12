import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Send, ArrowRightLeft, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface BankAccount { id: string; account_code: string; account_name: string; current_balance: number; }
interface FundTransfer {
  id: string; transfer_number: string; from_bank_account_id: string; to_bank_account_id: string;
  amount: number; transfer_date: string; reference: string | null; notes: string | null; status: string;
  from_bank?: { account_code: string; account_name: string } | null;
  to_bank?: { account_code: string; account_name: string } | null;
}

export default function FundTransfers() {
  const { hasRole, organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<FundTransfer | null>(null);
  const [form, setForm] = useState({
    from_bank_account_id: '', to_bank_account_id: '', amount: '',
    transfer_date: new Date().toISOString().split('T')[0], reference: '', notes: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: tData } = await supabase.from('fund_transfers').select('*').order('created_at', { ascending: false });
    const { data: bData } = await supabase.from('bank_accounts').select('id, account_code, account_name, current_balance').eq('is_active', true);
    const banks = (bData || []) as BankAccount[];
    setBankAccounts(banks);
    const bankMap = new Map(banks.map(b => [b.id, b]));
    const enriched = (tData || []).map((t: any) => ({
      ...t,
      from_bank: bankMap.get(t.from_bank_account_id) ? { account_code: bankMap.get(t.from_bank_account_id)!.account_code, account_name: bankMap.get(t.from_bank_account_id)!.account_name } : null,
      to_bank: bankMap.get(t.to_bank_account_id) ? { account_code: bankMap.get(t.to_bank_account_id)!.account_code, account_name: bankMap.get(t.to_bank_account_id)!.account_name } : null,
    }));
    setTransfers(enriched as FundTransfer[]);
    setLoading(false);
  };

  const openEditDialog = (t: FundTransfer) => {
    setEditingTransfer(t);
    setForm({
      from_bank_account_id: t.from_bank_account_id, to_bank_account_id: t.to_bank_account_id,
      amount: String(t.amount), transfer_date: t.transfer_date, reference: t.reference || '', notes: t.notes || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTransfer(null);
    setForm({ from_bank_account_id: '', to_bank_account_id: '', amount: '', transfer_date: new Date().toISOString().split('T')[0], reference: '', notes: '' });
  };

  const handleSave = async () => {
    if (!form.from_bank_account_id || !form.to_bank_account_id) { toast.error('Select both accounts'); return; }
    if (form.from_bank_account_id === form.to_bank_account_id) { toast.error('Cannot transfer to same account'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }

    if (editingTransfer) {
      const { error } = await supabase.from('fund_transfers').update({
        from_bank_account_id: form.from_bank_account_id, to_bank_account_id: form.to_bank_account_id,
        amount, transfer_date: form.transfer_date, reference: form.reference || null, notes: form.notes || null,
      }).eq('id', editingTransfer.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Transfer updated');
    } else {
      const txNum = `FT-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from('fund_transfers').insert({
        transfer_number: txNum, from_bank_account_id: form.from_bank_account_id,
        to_bank_account_id: form.to_bank_account_id, amount,
        transfer_date: form.transfer_date, reference: form.reference || null, notes: form.notes || null, organization_id: organizationId,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Transfer created');
    }
    setDialogOpen(false); resetForm(); fetchAll();
  };

  const handlePost = async (id: string) => {
    const { error } = await supabase.from('fund_transfers').update({ status: 'posted' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Transfer posted to GL'); fetchAll();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Fund Transfers" description="Transfer funds between bank accounts"
          actions={canManage ? <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Transfer</Button> : undefined} />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Transfer #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">From</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">To</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    {canManage && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfers.map(t => (
                    <tr key={t.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{t.transfer_number}</td>
                      <td className="px-4 py-2.5 text-sm">{t.from_bank?.account_name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm">{t.to_bank?.account_name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.transfer_date}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          {t.status === 'draft' && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(t)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handlePost(t.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No fund transfers found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTransfer ? 'Edit Fund Transfer' : 'New Fund Transfer'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>From Account</Label>
                <Select value={form.from_bank_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, from_bank_account_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select account...</SelectItem>
                    {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.account_code} - {b.account_name} ({formatCurrency(b.current_balance)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-center"><ArrowRightLeft className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <Label>To Account</Label>
                <Select value={form.to_bank_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, to_bank_account_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select account...</SelectItem>
                    {bankAccounts.filter(b => b.id !== form.from_bank_account_id).map(b => <SelectItem key={b.id} value={b.id}>{b.account_code} - {b.account_name} ({formatCurrency(b.current_balance)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Transfer Date</Label><Input type="date" value={form.transfer_date} onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))} /></div>
              </div>
              <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full">{editingTransfer ? 'Update Transfer' : 'Create Transfer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

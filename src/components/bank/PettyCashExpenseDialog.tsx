import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bankAccount: {
    id: string;
    account_name: string;
    current_balance: number;
    gl_account_id: string | null;
    organization_id?: string | null;
  };
  organizationId: string | null;
  onSaved?: () => void;
}

export function PettyCashExpenseDialog({ open, onOpenChange, bankAccount, organizationId, onSaved }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setAmount(''); setPayee(''); setExpenseAccountId(''); setReference(''); setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const expenseAccountsQ = useQuery({
    queryKey: ['gl_accounts', 'expense-postable'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts')
        .select('id, account_code, account_name')
        .eq('account_type', 'expense').eq('is_active', true).eq('is_header', false)
        .order('account_code');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!expenseAccountId) { toast.error('Select an expense account'); return; }
    if (!bankAccount.gl_account_id) { toast.error('This cash account has no linked GL account. Edit the bank account first.'); return; }
    if (!organizationId) { toast.error('Missing organization'); return; }
    if (amt > Number(bankAccount.current_balance || 0)) {
      toast.error(`Insufficient balance. Available: ${formatCurrency(bankAccount.current_balance)}`);
      return;
    }

    setSaving(true);
    try {
      // Find fiscal period
      const { data: period } = await supabase.from('gl_fiscal_periods')
        .select('id').eq('organization_id', organizationId).eq('status', 'open')
        .lte('start_date', date).gte('end_date', date).maybeSingle();
      if (!period) { toast.error('No open fiscal period covers this date'); setSaving(false); return; }

      const entryNumber = await getNextTransactionNumber(organizationId, 'JE', 'PCE');
      const desc = `Petty Cash Expense: ${payee || 'N/A'}${description ? ' — ' + description : ''}`;

      const { data: entry, error: eErr } = await supabase.from('gl_journal_entries').insert({
        entry_number: entryNumber,
        entry_date: date,
        description: desc,
        source_module: 'cash_management',
        fiscal_period_id: period.id,
        status: 'draft',
        organization_id: organizationId,
      } as any).select('id').single();
      if (eErr || !entry) throw eErr || new Error('Failed to create journal entry');

      const { error: lErr } = await supabase.from('gl_journal_lines').insert([
        { journal_entry_id: entry.id, line_number: 1, account_id: expenseAccountId, debit: amt, credit: 0, description: desc },
        { journal_entry_id: entry.id, line_number: 2, account_id: bankAccount.gl_account_id, debit: 0, credit: amt, description: desc },
      ] as any);
      if (lErr) throw lErr;

      const { error: pErr } = await supabase.from('gl_journal_entries').update({ status: 'posted' }).eq('id', entry.id);
      if (pErr) throw pErr;

      const { error: bErr } = await supabase.from('bank_transactions').insert({
        bank_account_id: bankAccount.id,
        transaction_date: date,
        transaction_type: 'withdrawal',
        amount: amt,
        description: desc,
        reference: reference || entryNumber,
        payee: payee || null,
        status: 'cleared',
        gl_journal_entry_id: entry.id,
        organization_id: organizationId,
      } as any);
      if (bErr) throw bErr;

      const { error: uErr } = await supabase.from('bank_accounts')
        .update({ current_balance: Number(bankAccount.current_balance || 0) - amt })
        .eq('id', bankAccount.id);
      if (uErr) throw uErr;

      toast.success('Petty cash expense recorded');
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Petty Cash Expense — {bankAccount.account_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            Available balance: <span className="font-semibold">{formatCurrency(bankAccount.current_balance)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
          </div>
          <div>
            <Label>Paid To (Payee)</Label>
            <Input value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. John Doe / Vendor name" />
          </div>
          <div>
            <Label>Expense Account</Label>
            <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
              <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
              <SelectContent>
                {(expenseAccountsQ.data || []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference / Receipt No.</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" rows={2} />
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? 'Recording...' : 'Record Expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

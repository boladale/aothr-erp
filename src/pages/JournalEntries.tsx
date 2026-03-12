import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/hooks/useAuth';

interface JournalLine { account_id: string; debit: number; credit: number; description: string; }

export default function JournalEntries() {
  const { user, hasRole, organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable') || hasRole('ap_clerk');
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], description: '', fiscal_period_id: '' });
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', debit: 0, credit: 0, description: '' },
    { account_id: '', debit: 0, credit: 0, description: '' },
  ]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [entriesRes, accountsRes, periodsRes] = await Promise.all([
      supabase.from('gl_journal_entries').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_header', false).eq('is_active', true).order('account_code'),
      supabase.from('gl_fiscal_periods').select('*').eq('status', 'open').order('period_number'),
    ]);
    setEntries(entriesRes.data || []);
    setAccounts(accountsRes.data || []);
    setPeriods(periodsRes.data || []);
    if (periodsRes.data && periodsRes.data.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const current = periodsRes.data.find((p: any) => p.start_date <= today && p.end_date >= today);
      if (current) setForm(f => ({ ...f, fiscal_period_id: current.id }));
    }
    setLoading(false);
  };

  const openEditDialog = async (entry: any) => {
    setEditingEntry(entry);
    setForm({ entry_date: entry.entry_date, description: entry.description || '', fiscal_period_id: entry.fiscal_period_id || '' });
    const { data } = await supabase.from('gl_journal_lines').select('*').eq('journal_entry_id', entry.id).order('line_number');
    setLines((data || []).map((l: any) => ({ account_id: l.account_id, debit: l.debit, credit: l.credit, description: l.description || '' })));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setForm({ entry_date: new Date().toISOString().split('T')[0], description: '', fiscal_period_id: periods[0]?.id || '' });
    setLines([{ account_id: '', debit: 0, credit: 0, description: '' }, { account_id: '', debit: 0, credit: 0, description: '' }]);
  };

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const addLine = () => setLines(l => [...l, { account_id: '', debit: 0, credit: 0, description: '' }]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(l => l.filter((_, idx) => idx !== i)); };

  const handleSave = async () => {
    if (!form.description) { toast.error('Description required'); return; }
    if (!form.fiscal_period_id) { toast.error('Select a fiscal period'); return; }
    if (!isBalanced) { toast.error('Entry must be balanced'); return; }
    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { toast.error('At least 2 lines required'); return; }

    if (editingEntry) {
      const { error } = await supabase.from('gl_journal_entries').update({
        entry_date: form.entry_date, description: form.description, fiscal_period_id: form.fiscal_period_id,
        total_debit: totalDebit, total_credit: totalCredit,
      }).eq('id', editingEntry.id);
      if (error) { toast.error(error.message); return; }
      await supabase.from('gl_journal_lines').delete().eq('journal_entry_id', editingEntry.id);
      await supabase.from('gl_journal_lines').insert(validLines.map((l, i) => ({
        journal_entry_id: editingEntry.id, line_number: i + 1, account_id: l.account_id,
        debit: l.debit || 0, credit: l.credit || 0, description: l.description || null,
      })));
      toast.success('Journal entry updated');
    } else {
      const entryNumber = `JE-${new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)}`;
      const { data: entry, error } = await supabase.from('gl_journal_entries').insert({
        entry_number: entryNumber, entry_date: form.entry_date, description: form.description,
        fiscal_period_id: form.fiscal_period_id, total_debit: totalDebit, total_credit: totalCredit,
        created_by: user?.id, organization_id: organizationId,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      await supabase.from('gl_journal_lines').insert(validLines.map((l, i) => ({
        journal_entry_id: entry.id, line_number: i + 1, account_id: l.account_id,
        debit: l.debit || 0, credit: l.credit || 0, description: l.description || null,
      })));
      toast.success(`Journal Entry ${entryNumber} created`);
    }
    setDialogOpen(false); resetForm(); fetchData();
  };

  const handlePost = async (id: string) => {
    const { error } = await supabase.from('gl_journal_entries').update({ status: 'posted' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Journal entry posted'); fetchData();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Journal Entries" description="Record and manage general ledger transactions"
          actions={canManage ? <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Entry</Button> : undefined} />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : entries.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No journal entries yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Entry #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Credit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-mono">{e.entry_number}</td>
                      <td className="px-4 py-3 text-sm">{e.entry_date}</td>
                      <td className="px-4 py-3 text-sm">{e.description}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.source_module || 'Manual'}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(e.total_debit)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(e.total_credit)}</td>
                      <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {e.status === 'draft' && canManage && !e.source_module && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(e)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="outline" size="sm" onClick={() => handlePost(e.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                          </div>
                        )}
                        {e.status === 'draft' && canManage && e.source_module && (
                          <Button variant="outline" size="sm" onClick={() => handlePost(e.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Entry Date</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
                <div>
                  <Label>Fiscal Period</Label>
                  <Select value={form.fiscal_period_id} onValueChange={v => setForm(f => ({ ...f, fiscal_period_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                    <SelectContent>{periods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly rent payment" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2"><Label>Lines</Label><Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button></div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-right w-32">Debit</th>
                      <th className="px-2 py-2 text-right w-32">Credit</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1">
                          <Select value={line.account_id} onValueChange={v => setLines(l => l.map((ll, idx) => idx === i ? { ...ll, account_id: v } : ll))}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1"><Input type="number" className="h-9 text-right" value={line.debit || ''} onChange={e => setLines(l => l.map((ll, idx) => idx === i ? { ...ll, debit: parseFloat(e.target.value) || 0, credit: parseFloat(e.target.value) > 0 ? 0 : ll.credit } : ll))} /></td>
                        <td className="px-2 py-1"><Input type="number" className="h-9 text-right" value={line.credit || ''} onChange={e => setLines(l => l.map((ll, idx) => idx === i ? { ...ll, credit: parseFloat(e.target.value) || 0, debit: parseFloat(e.target.value) > 0 ? 0 : ll.debit } : ll))} /></td>
                        <td className="px-2 py-1"><Input className="h-9" value={line.description} onChange={e => setLines(l => l.map((ll, idx) => idx === i ? { ...ll, description: e.target.value } : ll))} /></td>
                        <td className="px-2 py-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(i)} disabled={lines.length <= 2}><Trash2 className="h-3 w-3" /></Button></td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-muted/30">
                      <td className="px-2 py-2 text-right">Totals:</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(totalDebit)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(totalCredit)}</td>
                      <td className="px-2 py-2">
                        {isBalanced ? <span className="text-success text-xs">✓ Balanced</span> : <span className="text-destructive text-xs">✗ Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={!isBalanced}>{editingEntry ? 'Update Journal Entry' : 'Create Journal Entry'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Pencil, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/hooks/useAuth';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { Checkbox } from '@/components/ui/checkbox';

interface JournalLine { account_id: string; debit: number; credit: number; description: string; }

export default function JournalEntries() {
  const { user, hasRole, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('admin') || hasRole('accounts_payable') || hasRole('ap_clerk');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], description: '', fiscal_period_id: '' });
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', debit: 0, credit: 0, description: '' },
    { account_id: '', debit: 0, credit: 0, description: '' },
  ]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const entriesQ = useQuery({
    queryKey: ['gl_journal_entries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_journal_entries').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });
  const accountsQ = useQuery({
    queryKey: ['gl_accounts-leaf'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_header', false).eq('is_active', true).order('account_code');
      if (error) throw error;
      return data || [];
    },
  });
  const periodsQ = useQuery({
    queryKey: ['gl_fiscal_periods-open'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_fiscal_periods').select('*').eq('status', 'open').order('period_number');
      if (error) throw error;
      return data || [];
    },
  });
  const entries = entriesQ.data || [];
  const accounts = accountsQ.data || [];
  const periods = periodsQ.data || [];
  const loading = entriesQ.isLoading;

  // Auto-select current fiscal period when periods load
  useEffect(() => {
    if (periods.length > 0 && !form.fiscal_period_id) {
      const today = new Date().toISOString().split('T')[0];
      const current = periods.find((p: any) => p.start_date <= today && p.end_date >= today);
      if (current) setForm(f => ({ ...f, fiscal_period_id: current.id }));
    }
  }, [periods, form.fiscal_period_id]);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
      if (editingEntry) {
        const { error } = await supabase.from('gl_journal_entries').update({
          entry_date: form.entry_date, description: form.description, fiscal_period_id: form.fiscal_period_id,
          total_debit: totalDebit, total_credit: totalCredit,
        }).eq('id', editingEntry.id);
        if (error) throw error;
        await supabase.from('gl_journal_lines').delete().eq('journal_entry_id', editingEntry.id);
        await supabase.from('gl_journal_lines').insert(validLines.map((l, i) => ({
          journal_entry_id: editingEntry.id, line_number: i + 1, account_id: l.account_id,
          debit: l.debit || 0, credit: l.credit || 0, description: l.description || null,
        })));
        return 'Journal entry updated';
      } else {
        const entryNumber = await getNextTransactionNumber(organizationId!, 'JE', 'JE');
        const { data: entry, error } = await supabase.from('gl_journal_entries').insert({
          entry_number: entryNumber, entry_date: form.entry_date, description: form.description,
          fiscal_period_id: form.fiscal_period_id, total_debit: totalDebit, total_credit: totalCredit,
          created_by: user?.id, organization_id: organizationId,
        }).select().single();
        if (error) throw error;
        await supabase.from('gl_journal_lines').insert(validLines.map((l, i) => ({
          journal_entry_id: entry.id, line_number: i + 1, account_id: l.account_id,
          debit: l.debit || 0, credit: l.credit || 0, description: l.description || null,
        })));
        return `Journal Entry ${entryNumber} created`;
      }
    },
    onSuccess: (msg) => {
      queryClient.invalidateQueries({ queryKey: ['gl_journal_entries'] });
      setDialogOpen(false);
      resetForm();
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = (opts?: { draft?: boolean }) => {
    if (!form.description) { toast.error('Description required'); return; }
    if (!form.fiscal_period_id) { toast.error('Select a fiscal period'); return; }
    if (!opts?.draft && !isBalanced) { toast.error('Entry must be balanced'); return; }
    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 1) { toast.error('Add at least one line'); return; }
    saveMutation.mutate();
  };

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gl_journal_entries').update({ status: 'posted' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gl_journal_entries'] });
      toast.success('Journal entry posted');
    },
    onError: (err: any) => toast.error(err.message),
  });
  const handlePost = (id: string) => postMutation.mutate(id);

  const reverseMutation = useMutation({
    mutationFn: async (entry: any) => {
      const today = new Date().toISOString().split('T')[0];
      const period = periods.find((p: any) => p.start_date <= today && p.end_date >= today) || periods[0];
      if (!period) throw new Error('No open fiscal period available for reversal');
      const { data: origLines, error: linesErr } = await supabase.from('gl_journal_lines').select('*').eq('journal_entry_id', entry.id).order('line_number');
      if (linesErr) throw linesErr;
      if (!origLines || origLines.length === 0) throw new Error('Original entry has no lines');
      const entryNumber = await getNextTransactionNumber(organizationId!, 'JE', 'JE');
      const { data: newEntry, error } = await supabase.from('gl_journal_entries').insert({
        entry_number: entryNumber,
        entry_date: today,
        description: `Reversal of ${entry.entry_number}: ${entry.description || ''}`.slice(0, 500),
        fiscal_period_id: period.id,
        total_debit: entry.total_credit,
        total_credit: entry.total_debit,
        created_by: user?.id,
        organization_id: organizationId,
        source_module: 'reversal',
        source_id: entry.id,
      }).select().single();
      if (error) throw error;
      const reversed = origLines.map((l: any, i: number) => ({
        journal_entry_id: newEntry.id, line_number: i + 1, account_id: l.account_id,
        debit: l.credit || 0, credit: l.debit || 0,
        description: `Reversal: ${l.description || ''}`.slice(0, 500),
      }));
      const { error: insErr } = await supabase.from('gl_journal_lines').insert(reversed);
      if (insErr) throw insErr;
      const { error: postErr } = await supabase.from('gl_journal_entries').update({ status: 'posted' }).eq('id', newEntry.id);
      if (postErr) throw postErr;
      return entryNumber;
    },
    onSuccess: (num) => {
      queryClient.invalidateQueries({ queryKey: ['gl_journal_entries'] });
      toast.success(`Reversal entry ${num} posted`);
    },
    onError: (err: any) => toast.error(err.message),
  });
  const handleReverse = (entry: any) => {
    if (!window.confirm(`Reverse posted entry ${entry.entry_number}? A new offsetting posted entry will be created dated today.`)) return;
    reverseMutation.mutate(entry);
  };

  const bulkPostMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('gl_journal_entries').update({ status: 'posted' }).in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['gl_journal_entries'] });
      setSelectedIds([]);
      toast.success(`${count} entries posted`);
    },
    onError: (err: any) => toast.error(err.message),
  });
  const bulkProcessing = bulkPostMutation.isPending;

  const handleBulkPost = () => {
    const draftIds = selectedIds.filter(id => entries.find((e: any) => e.id === id)?.status === 'draft');
    if (!draftIds.length) { toast.error('No draft entries selected'); return; }
    if (!window.confirm(`Post ${draftIds.length} journal entries?`)) return;
    bulkPostMutation.mutate(draftIds);
  };

  const filteredEntries = entries.filter((e: any) => {
    if (dateFrom && e.entry_date < dateFrom) return false;
    if (dateTo && e.entry_date > dateTo) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.entry_number?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.source_module?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const draftEntries = filteredEntries.filter((e: any) => e.status === 'draft');
  const allDraftSelected = draftEntries.length > 0 && draftEntries.every((e: any) => selectedIds.includes(e.id));
  const someDraftSelected = draftEntries.some((e: any) => selectedIds.includes(e.id));

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Journal Entries" description="Record and manage general ledger transactions"
          actions={canManage ? <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Entry</Button> : undefined} />

        {canManage && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            actions={[
              { label: 'Post All', icon: <CheckCircle className="h-4 w-4 mr-1" />, onClick: handleBulkPost, disabled: bulkProcessing, variant: 'default' },
            ]}
          />
        )}

        <Card>
          <CardContent className="p-4 border-b">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-48">
                <Label className="text-xs">Search</Label>
                <Input placeholder="Entry #, description, source" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {(dateFrom || dateTo || statusFilter !== 'all' || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearch(''); }}>Clear</Button>
              )}
              <div className="text-xs text-muted-foreground ml-auto">{filteredEntries.length} of {entries.length}</div>
            </div>
          </CardContent>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filteredEntries.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">{entries.length === 0 ? 'No journal entries yet' : 'No entries match the filters'}</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {canManage && (
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={allDraftSelected ? true : someDraftSelected ? 'indeterminate' : false}
                          onCheckedChange={() => {
                            if (allDraftSelected) setSelectedIds(selectedIds.filter(id => !draftEntries.find((e: any) => e.id === id)));
                            else setSelectedIds([...new Set([...selectedIds, ...draftEntries.map((e: any) => e.id)])]);
                          }}
                        />
                      </th>
                    )}
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
                  {filteredEntries.map((e: any) => (
                    <tr key={e.id} className={`hover:bg-muted/50 ${selectedIds.includes(e.id) ? 'bg-primary/5' : ''}`}>
                      {canManage && (
                        <td className="px-4 py-3">
                          {e.status === 'draft' && (
                            <Checkbox
                              checked={selectedIds.includes(e.id)}
                              onCheckedChange={() => {
                                if (selectedIds.includes(e.id)) setSelectedIds(selectedIds.filter(i => i !== e.id));
                                else setSelectedIds([...selectedIds, e.id]);
                              }}
                            />
                          )}
                        </td>
                      )}
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
                        {e.status === 'posted' && canManage && e.source_module !== 'reversal' && (
                          <Button variant="outline" size="sm" disabled={reverseMutation.isPending} onClick={() => handleReverse(e)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Reverse
                          </Button>
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

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave({ draft: true })} className="flex-1" disabled={saveMutation.isPending}>Save as Draft</Button>
                <Button onClick={() => handleSave()} className="flex-1" disabled={!isBalanced || saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : (editingEntry ? 'Update Journal Entry' : 'Create Journal Entry')}</Button>
                {editingEntry && editingEntry.status === 'draft' && (
                  <Button
                    variant="default"
                    className="flex-1 bg-success hover:bg-success/90"
                    disabled={!isBalanced || postMutation.isPending}
                    onClick={async () => {
                      await saveMutation.mutateAsync();
                      handlePost(editingEntry.id);
                    }}
                  ><Send className="h-4 w-4 mr-1" /> Save & Post</Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

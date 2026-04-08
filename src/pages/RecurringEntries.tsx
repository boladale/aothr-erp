import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Play, Pause, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
}

interface RecurringEntry {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  next_run_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_at: string | null;
  created_at: string;
}

interface RecurringLine {
  id?: string;
  line_number: number;
  account_id: string;
  debit: number;
  credit: number;
  description: string;
}

export default function RecurringEntries() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [nextRunDate, setNextRunDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lines, setLines] = useState<RecurringLine[]>([
    { line_number: 1, account_id: '', debit: 0, credit: 0, description: '' },
    { line_number: 2, account_id: '', debit: 0, credit: 0, description: '' },
  ]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [entriesRes, accountsRes] = await Promise.all([
      supabase.from('gl_recurring_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_active', true).eq('is_header', false).order('account_code'),
    ]);
    setEntries((entriesRes.data || []) as RecurringEntry[]);
    setAccounts((accountsRes.data || []) as GLAccount[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(''); setDescription(''); setFrequency('monthly'); setNextRunDate(''); setEndDate('');
    setLines([
      { line_number: 1, account_id: '', debit: 0, credit: 0, description: '' },
      { line_number: 2, account_id: '', debit: 0, credit: 0, description: '' },
    ]);
  };

  const addLine = () => {
    setLines([...lines, { line_number: lines.length + 1, account_id: '', debit: 0, credit: 0, description: '' }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 })));
  };

  const updateLine = (idx: number, field: string, value: string | number) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  const handleSave = async () => {
    if (!name || !nextRunDate) {
      toast.error('Name and next run date are required');
      return;
    }
    if (totalDebit !== totalCredit || totalDebit === 0) {
      toast.error('Debits must equal credits and be greater than zero');
      return;
    }
    if (lines.some(l => !l.account_id)) {
      toast.error('All lines must have an account');
      return;
    }

    const { data: entry, error } = await supabase.from('gl_recurring_entries').insert({
      name, description: description || null, frequency,
      next_run_date: nextRunDate, end_date: endDate || null,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    const lineInserts = lines.map(l => ({
      recurring_entry_id: entry.id,
      line_number: l.line_number,
      account_id: l.account_id,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      description: l.description || null,
    }));

    const { error: lineErr } = await supabase.from('gl_recurring_entry_lines').insert(lineInserts);
    if (lineErr) { toast.error(lineErr.message); return; }

    toast.success('Recurring entry created');
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    const { data, error } = await supabase.rpc('generate_recurring_entry', { p_recurring_id: id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Journal entry generated and posted');
    }
    setGenerating(null);
    fetchData();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('gl_recurring_entries').update({ is_active: !currentActive }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(currentActive ? 'Recurring entry paused' : 'Recurring entry activated');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('gl_recurring_entries').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Recurring entry deleted');
    fetchData();
  };

  return (
    <AppLayout>
      <PageHeader title="Recurring Journal Entries" description="Automate monthly, quarterly, or yearly journal entries">
        {isAdmin && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No recurring entries configured.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{entry.name}</h3>
                    <StatusBadge status={entry.is_active ? 'active' : 'inactive'} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {entry.frequency.charAt(0).toUpperCase() + entry.frequency.slice(1)} · Next: {format(new Date(entry.next_run_date), 'MMM d, yyyy')}
                    {entry.last_generated_at && ` · Last run: ${format(new Date(entry.last_generated_at), 'MMM d, yyyy')}`}
                  </p>
                  {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerate(entry.id)}
                      disabled={!entry.is_active || generating === entry.id}
                    >
                      <Play className="h-3 w-3 mr-1" /> {generating === entry.id ? 'Generating...' : 'Generate Now'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleActive(entry.id, entry.is_active)}>
                      {entry.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Recurring Journal Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Depreciation" /></div>
              <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Next Run Date *</Label><Input type="date" value={nextRunDate} onChange={e => setNextRunDate(e.target.value)} /></div>
              <div><Label>End Date (optional)</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Journal Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Line</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-2 text-left">Account</th>
                      <th className="p-2 text-right w-32">Debit</th>
                      <th className="p-2 text-right w-32">Credit</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">
                          <Select value={line.account_id} onValueChange={v => updateLine(idx, 'account_id', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {accounts.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="text-right" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-2"><Input type="number" min="0" step="0.01" className="text-right" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} /></td>
                        <td className="p-2"><Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} /></td>
                        <td className="p-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(idx)} disabled={lines.length <= 2}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20 font-medium">
                      <td className="p-2 text-right">Totals:</td>
                      <td className="p-2 text-right">{totalDebit.toFixed(2)}</td>
                      <td className="p-2 text-right">{totalCredit.toFixed(2)}</td>
                      <td colSpan={2} className="p-2">
                        {totalDebit !== totalCredit && <span className="text-destructive text-xs">Unbalanced!</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={totalDebit !== totalCredit || totalDebit === 0}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

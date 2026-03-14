import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, CheckCircle, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface BankAccount { id: string; account_code: string; account_name: string; current_balance: number; }
interface BankTransaction {
  id: string; bank_account_id: string; transaction_date: string; transaction_type: string;
  amount: number; description: string | null; reference: string | null; payee: string | null;
  status: string; reconciliation_id: string | null;
}
interface Reconciliation {
  id: string; bank_account_id: string; reconciliation_date: string;
  statement_start_date: string; statement_end_date: string;
  statement_ending_balance: number; gl_balance: number; reconciled_balance: number;
  difference: number; status: string;
  bank_accounts?: { account_name: string; account_code: string } | null;
}

export default function BankReconciliation() {
  const { hasRole, organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Reconciliation form
  const [selectedBank, setSelectedBank] = useState('');
  const [stmtEndBalance, setStmtEndBalance] = useState('');
  const [stmtStartDate, setStmtStartDate] = useState('');
  const [stmtEndDate, setStmtEndDate] = useState('');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [checkedTxns, setCheckedTxns] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [bankRes, recRes] = await Promise.all([
      supabase.from('bank_accounts').select('id, account_code, account_name, current_balance').eq('is_active', true),
      supabase.from('bank_reconciliations').select('*, bank_accounts(account_name, account_code)').order('created_at', { ascending: false }).limit(20),
    ]);
    setBankAccounts((bankRes.data || []) as BankAccount[]);
    setReconciliations((recRes.data || []) as Reconciliation[]);
    setLoading(false);
  };

  const onBankChange = async (bankId: string) => {
    setSelectedBank(bankId);
    if (!bankId) { setTransactions([]); return; }
    const { data } = await supabase.from('bank_transactions')
      .select('*')
      .eq('bank_account_id', bankId)
      .eq('status', 'unreconciled')
      .order('transaction_date');
    setTransactions((data || []) as BankTransaction[]);
    setCheckedTxns(new Set());
  };

  const toggleTxn = (id: string) => {
    setCheckedTxns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reconciledTotal = transactions
    .filter(t => checkedTxns.has(t.id))
    .reduce((s, t) => s + t.amount, 0);

  const handleAiSuggest = async () => {
    if (!selectedBank || transactions.length === 0) {
      toast.error('Select a bank account with unreconciled transactions first');
      return;
    }
    setAiLoading(true);
    setAiReasoning('');
    try {
      const bank = bankAccounts.find(b => b.id === selectedBank);
      const resp = await supabase.functions.invoke('ai-reconcile', {
        body: {
          transactions,
          statementEndBalance: parseFloat(stmtEndBalance) || 0,
          glBalance: bank?.current_balance || 0,
          statementStartDate: stmtStartDate,
          statementEndDate: stmtEndDate,
        }
      });
      if (resp.error) throw resp.error;
      const data = resp.data as { suggestedIds?: string[]; reasoning?: string; error?: string };
      if (data.error) { toast.error(data.error); return; }
      if (data.suggestedIds && data.suggestedIds.length > 0) {
        setCheckedTxns(new Set(data.suggestedIds));
        setAiReasoning(data.reasoning || '');
        toast.success(`AI suggested ${data.suggestedIds.length} transaction(s)`);
      } else {
        toast.info(data.reasoning || 'AI could not find matching transactions');
      }
    } catch (err: any) {
      toast.error(err.message || 'AI reconciliation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedBank || !stmtEndBalance || !stmtStartDate || !stmtEndDate) {
      toast.error('Fill all reconciliation fields'); return;
    }

    const bank = bankAccounts.find(b => b.id === selectedBank);
    const stmtBal = parseFloat(stmtEndBalance);
    const glBal = bank?.current_balance || 0;

    const { data: rec, error: recErr } = await supabase.from('bank_reconciliations').insert({
      bank_account_id: selectedBank,
      statement_start_date: stmtStartDate,
      statement_end_date: stmtEndDate,
      statement_ending_balance: stmtBal,
      gl_balance: glBal,
      reconciled_balance: reconciledTotal,
      difference: stmtBal - glBal - reconciledTotal,
      status: 'completed',
      completed_at: new Date().toISOString(),
      organization_id: organizationId,
    }).select().single();

    if (recErr) { toast.error(recErr.message); return; }

    // Mark checked transactions as reconciled
    if (checkedTxns.size > 0) {
      await supabase.from('bank_transactions')
        .update({ status: 'reconciled', reconciliation_id: rec.id })
        .in('id', Array.from(checkedTxns));
    }

    toast.success('Reconciliation completed');
    setDialogOpen(false);
    setSelectedBank('');
    setTransactions([]);
    setCheckedTxns(new Set());
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Bank Reconciliation"
          description="Match bank statement entries against GL transactions"
          actions={canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Reconciliation</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Bank Reconciliation</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bank Account</Label>
                      <Select value={selectedBank || 'none'} onValueChange={v => onBankChange(v === 'none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select bank account...</SelectItem>
                          {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.account_code} - {b.account_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Statement Ending Balance</Label><Input type="number" value={stmtEndBalance} onChange={e => setStmtEndBalance(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Statement Start Date</Label><Input type="date" value={stmtStartDate} onChange={e => setStmtStartDate(e.target.value)} /></div>
                    <div><Label>Statement End Date</Label><Input type="date" value={stmtEndDate} onChange={e => setStmtEndDate(e.target.value)} /></div>
                  </div>

                  {selectedBank && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex justify-between items-center">
                          <span>Unreconciled Transactions</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAiSuggest}
                              disabled={aiLoading || transactions.length === 0}
                              className="text-xs"
                            >
                              {aiLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                              AI Match
                            </Button>
                            <span className="text-muted-foreground">{checkedTxns.size} selected • {formatCurrency(reconciledTotal)}</span>
                          </div>
                        </CardTitle>
                        {aiReasoning && (
                          <p className="text-xs text-muted-foreground mt-1 bg-primary/5 p-2 rounded">{aiReasoning}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        {transactions.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No unreconciled transactions</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {transactions.map(txn => (
                              <div key={txn.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                                <Checkbox checked={checkedTxns.has(txn.id)} onCheckedChange={() => toggleTxn(txn.id)} />
                                <span className="text-xs text-muted-foreground w-20">{txn.transaction_date}</span>
                                <span className="text-xs capitalize w-20">{txn.transaction_type.replace('_', ' ')}</span>
                                <span className="text-sm flex-1 truncate">{txn.description || txn.payee || '—'}</span>
                                <span className={`text-sm font-mono font-medium ${txn.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {formatCurrency(txn.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {selectedBank && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">GL Balance</p>
                        <p className="font-semibold">{formatCurrency(bankAccounts.find(b => b.id === selectedBank)?.current_balance || 0)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">Reconciled Items</p>
                        <p className="font-semibold">{formatCurrency(reconciledTotal)}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">Difference</p>
                        <p className="font-semibold">{formatCurrency((parseFloat(stmtEndBalance) || 0) - (bankAccounts.find(b => b.id === selectedBank)?.current_balance || 0) - reconciledTotal)}</p>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleReconcile} className="w-full">Complete Reconciliation</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined}
        />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Bank Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Statement Balance</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">GL Balance</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Difference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reconciliations.map(rec => (
                    <tr key={rec.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm">{rec.bank_accounts?.account_code} - {rec.bank_accounts?.account_name}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{rec.statement_start_date} to {rec.statement_end_date}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(rec.statement_ending_balance)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(rec.gl_balance)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">
                        <span className={rec.difference === 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(rec.difference)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={rec.status === 'completed' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}>
                          {rec.status === 'completed' ? 'Completed' : 'In Progress'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{rec.reconciliation_date}</td>
                    </tr>
                  ))}
                  {reconciliations.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No reconciliations found</td></tr>
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

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, CheckCircle, Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('admin');
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [lineForm, setLineForm] = useState<any>({
    department_id: '', account_id: '', description: '', annual_amount: 0, q1: 0, q2: 0, q3: 0, q4: 0,
  });
  const [txFilter, setTxFilter] = useState({ department: 'all', account: 'all', type: 'all' });

  const { data: budget, isLoading } = useQuery({
    queryKey: ['budget', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['budget-lines', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_lines')
        .select('*, department:departments(id, name, code), account:gl_accounts(id, account_code, account_name)')
        .eq('budget_id', id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name, code').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['gl-accounts-list'],
    queryFn: async () => {
      const { data } = await supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_active', true).eq('is_header', false).order('account_code');
      return data || [];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['budget-tx', id],
    queryFn: async () => {
      const lineIds = lines.map((l: any) => l.id);
      if (!lineIds.length) return [];
      const { data, error } = await (supabase as any)
        .from('budget_transactions')
        .select('*')
        .in('budget_line_id', lineIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: lines.length > 0,
  });

  const addLineMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('budget_lines').insert({
        budget_id: id!,
        department_id: lineForm.department_id || null,
        account_id: lineForm.account_id || null,
        description: lineForm.description,
        annual_amount: lineForm.annual_amount,
        q1: lineForm.q1, q2: lineForm.q2, q3: lineForm.q3, q4: lineForm.q4,
        budgeted_amount: lineForm.annual_amount,
        category: lineForm.description || 'general',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Line added' });
      qc.invalidateQueries({ queryKey: ['budget-lines', id] });
      setAddLineOpen(false);
      setLineForm({ department_id: '', account_id: '', description: '', annual_amount: 0, q1: 0, q2: 0, q3: 0, q4: 0 });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteLineMut = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from('budget_lines').delete().eq('id', lineId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-lines', id] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const statusMut = useMutation({
    mutationFn: async (newStatus: 'active' | 'frozen' | 'closed') => {
      const patch: any = { status: newStatus };
      if (newStatus === 'active') {
        patch.approved_by = user?.id;
        patch.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('budgets').update(patch).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Budget updated' });
      qc.invalidateQueries({ queryKey: ['budget', id] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const isDraft = budget?.status === 'draft';

  // group by department then account
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    lines.forEach((l: any) => {
      const key = l.department?.name || 'Unassigned';
      (map[key] ||= []).push(l);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [lines]);

  // chart data: by department
  const chartData = useMemo(() => {
    const map: Record<string, { name: string; Budget: number; Committed: number; Actual: number }> = {};
    lines.forEach((l: any) => {
      const name = l.department?.name || 'Unassigned';
      if (!map[name]) map[name] = { name, Budget: 0, Committed: 0, Actual: 0 };
      map[name].Budget += Number(l.annual_amount || 0);
      map[name].Committed += Number(l.committed_amount || 0);
      map[name].Actual += Number(l.actual_amount || 0);
    });
    return Object.values(map);
  }, [lines]);

  const filteredTx = useMemo(() => {
    return transactions.filter((t: any) => {
      const line = lines.find((l: any) => l.id === t.budget_line_id);
      if (!line) return false;
      if (txFilter.department !== 'all' && line.department_id !== txFilter.department) return false;
      if (txFilter.account !== 'all' && line.account_id !== txFilter.account) return false;
      if (txFilter.type !== 'all' && t.transaction_type !== txFilter.type) return false;
      return true;
    });
  }, [transactions, lines, txFilter]);

  const usagePct = (l: any) => {
    const used = Number(l.committed_amount || 0) + Number(l.actual_amount || 0);
    const total = Number(l.annual_amount || 0);
    return total > 0 ? (used / total) * 100 : 0;
  };
  const usageColor = (pct: number) =>
    pct > 90 ? 'text-destructive font-semibold' : pct >= 70 ? 'text-warning font-medium' : 'text-success';

  if (isLoading || !budget) {
    return <AppLayout><div className="page-container"><Skeleton className="h-96" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/budgets')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Budgets
        </Button>

        <PageHeader
          title={budget.name}
          description={`Fiscal Year ${budget.fiscal_year}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={budget.status} />
              {isAdmin && isDraft && (
                <Button onClick={() => statusMut.mutate('active')} size="sm">
                  <CheckCircle className="mr-1 h-4 w-4" /> Approve Budget
                </Button>
              )}
              {isAdmin && budget.status === 'active' && (
                <Button onClick={() => statusMut.mutate('frozen')} variant="outline" size="sm">
                  <Lock className="mr-1 h-4 w-4" /> Freeze Budget
                </Button>
              )}
            </div>
          }
        />

        <Tabs defaultValue="lines">
          <TabsList>
            <TabsTrigger value="lines">Budget Lines</TabsTrigger>
            <TabsTrigger value="tx">Transactions Log</TabsTrigger>
            <TabsTrigger value="chart">Budget vs Actual</TabsTrigger>
          </TabsList>

          <TabsContent value="lines" className="space-y-4">
            {isDraft && (
              <div className="flex justify-end">
                <Button onClick={() => setAddLineOpen(true)} size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Add Line
                </Button>
              </div>
            )}
            {grouped.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">No budget lines yet.</CardContent></Card>
            ) : (
              grouped.map(([deptName, deptLines]) => (
                <Card key={deptName}>
                  <CardHeader><CardTitle className="text-base">{deptName}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead className="text-right">Annual</TableHead>
                          <TableHead className="text-right">Q1</TableHead>
                          <TableHead className="text-right">Q2</TableHead>
                          <TableHead className="text-right">Q3</TableHead>
                          <TableHead className="text-right">Q4</TableHead>
                          <TableHead className="text-right">Committed</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="text-right">% Used</TableHead>
                          {isDraft && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deptLines.map((l: any) => {
                          const pct = usagePct(l);
                          const remaining = Number(l.annual_amount || 0) - Number(l.committed_amount || 0) - Number(l.actual_amount || 0);
                          return (
                            <TableRow key={l.id}>
                              <TableCell className="font-mono text-xs">{l.account?.account_code || '—'}</TableCell>
                              <TableCell>{l.account?.account_name || l.description || '—'}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.annual_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.q1)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.q2)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.q3)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.q4)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.committed_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.actual_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(remaining)}</TableCell>
                              <TableCell className={`text-right ${usageColor(pct)}`}>{pct.toFixed(1)}%</TableCell>
                              {isDraft && (
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => deleteLineMut.mutate(l.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="tx" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-wrap gap-2">
                <Select value={txFilter.department} onValueChange={(v) => setTxFilter({ ...txFilter, department: v })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={txFilter.account} onValueChange={(v) => setTxFilter({ ...txFilter, account: v })}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={txFilter.type} onValueChange={(v) => setTxFilter({ ...txFilter, type: v })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="commit">Commit</SelectItem>
                    <SelectItem value="uncommit">Uncommit</SelectItem>
                    <SelectItem value="actual">Actual</SelectItem>
                    <SelectItem value="reverse">Reverse</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              {filteredTx.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No transactions yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTx.map((t: any) => {
                      const line = lines.find((l: any) => l.id === t.budget_line_id);
                      return (
                        <TableRow key={t.id}>
                          <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant="outline">{t.transaction_type}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{t.reference_type ? `${t.reference_type}` : '—'}</TableCell>
                          <TableCell>{line?.department?.name || '—'}</TableCell>
                          <TableCell>{line?.account?.account_code || '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="chart">
            <Card>
              <CardHeader><CardTitle>Budget vs Committed vs Actual by Department</CardTitle></CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No data to display.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Legend />
                      <Bar dataKey="Budget" fill="hsl(217 91% 60%)" />
                      <Bar dataKey="Committed" fill="hsl(38 92% 50%)" />
                      <Bar dataKey="Actual" fill="hsl(142 71% 45%)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addLineOpen} onOpenChange={setAddLineOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Budget Line</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Select value={lineForm.department_id} onValueChange={(v) => setLineForm({ ...lineForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account</Label>
                <Select value={lineForm.account_id} onValueChange={(v) => setLineForm({ ...lineForm, account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Annual Amount</Label>
              <Input type="number" value={lineForm.annual_amount} onChange={(e) => {
                const v = Number(e.target.value);
                const q = Math.round((v / 4) * 100) / 100;
                setLineForm({ ...lineForm, annual_amount: v, q1: q, q2: q, q3: q, q4: v - q * 3 });
              }} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                <div key={q}>
                  <Label>{q.toUpperCase()}</Label>
                  <Input type="number" value={lineForm[q]} onChange={(e) => setLineForm({ ...lineForm, [q]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineOpen(false)}>Cancel</Button>
            <Button onClick={() => addLineMut.mutate()} disabled={!lineForm.annual_amount || addLineMut.isPending}>Add Line</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

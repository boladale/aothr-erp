import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_header: boolean;
  parent_id: string | null;
  normal_balance: string;
  debit_total: number;
  credit_total: number;
  balance: number;
}

export default function FinancialReports() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  const { data: periods = [] } = useQuery({
    queryKey: ['gl-fiscal-periods-all'],
    queryFn: async () => {
      const { data } = await supabase.from('gl_fiscal_periods').select('*').order('fiscal_year', { ascending: false }).order('period_number', { ascending: false });
      return data || [];
    },
  });

  const { data: balances = [], isLoading: loading } = useQuery<AccountBalance[]>({
    queryKey: ['gl-balances-from-lines', selectedPeriod],
    queryFn: async () => {
      // Load all active GL accounts so empty ones still appear
      const { data: accts, error: acctsErr } = await supabase
        .from('gl_accounts')
        .select('id, account_code, account_name, account_type, is_header, parent_id, normal_balance')
        .eq('is_active', true);
      if (acctsErr) throw acctsErr;

      // Sum posted journal lines directly so Balance Sheet matches sub-ledger reports
      // (Inventory Valuation, AR/AP aging, etc.) instead of relying on a cached table.
      let linesQuery = supabase
        .from('gl_journal_lines')
        .select('account_id, debit, credit, gl_journal_entries!inner(status, fiscal_period_id)')
        .eq('gl_journal_entries.status', 'posted');
      if (selectedPeriod !== 'all') {
        linesQuery = linesQuery.eq('gl_journal_entries.fiscal_period_id', selectedPeriod);
      }
      const { data: lines, error: linesErr } = await linesQuery;
      if (linesErr) throw linesErr;

      const sums = new Map<string, { d: number; c: number }>();
      (lines || []).forEach((l: any) => {
        const s = sums.get(l.account_id) || { d: 0, c: 0 };
        s.d += Number(l.debit || 0);
        s.c += Number(l.credit || 0);
        sums.set(l.account_id, s);
      });

      return (accts || [])
        .map((a: any) => {
          const s = sums.get(a.id) || { d: 0, c: 0 };
          const normal = a.normal_balance || (['asset', 'expense'].includes(a.account_type) ? 'debit' : 'credit');
          const balance = normal === 'debit' ? s.d - s.c : s.c - s.d;
          return {
            account_id: a.id,
            account_code: a.account_code || '',
            account_name: a.account_name || '',
            account_type: a.account_type || '',
            is_header: a.is_header || false,
            parent_id: a.parent_id || null,
            normal_balance: normal,
            debit_total: s.d,
            credit_total: s.c,
            balance,
          } as AccountBalance;
        })
        .sort((a, b) => a.account_code.localeCompare(b.account_code));
    },
  });

  const trialBalanceAccounts = balances.filter(b => b.debit_total > 0 || b.credit_total > 0);
  const totalTBDebit = trialBalanceAccounts.reduce((s, b) => s + b.debit_total, 0);
  const totalTBCredit = trialBalanceAccounts.reduce((s, b) => s + b.credit_total, 0);

  const revenueAccounts = balances.filter(b => b.account_type === 'revenue');
  const expenseAccounts = balances.filter(b => b.account_type === 'expense');
  const totalRevenue = revenueAccounts.reduce((s, b) => s + b.balance, 0);
  const totalExpenses = expenseAccounts.reduce((s, b) => s + b.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const assetAccounts = balances.filter(b => b.account_type === 'asset');
  const liabilityAccounts = balances.filter(b => b.account_type === 'liability');
  const equityAccounts = balances.filter(b => b.account_type === 'equity');
  const totalAssets = assetAccounts.reduce((s, b) => s + b.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((s, b) => s + b.balance, 0);
  const totalEquity = equityAccounts.reduce((s, b) => s + b.balance, 0) + netIncome;

  const renderReportTable = (items: AccountBalance[], label: string, total: number) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">{label}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No transactions</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {items.map(b => (
              <tr key={b.account_id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 pl-4">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{b.account_code}</span>
                  {b.account_name}
                </td>
                <td className="py-2 pr-4 text-right font-mono">{formatCurrency(b.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2 border-foreground/20">
              <td className="py-2 pl-4">Total {label}</td>
              <td className="py-2 pr-4 text-right font-mono">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Financial Reports"
          description="Trial Balance, Profit & Loss, and Balance Sheet"
          actions={
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Periods" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                {periods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        />

        {loading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
        ) : (
          <Tabs defaultValue="trial-balance">
            <TabsList>
              <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
              <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
              <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            </TabsList>

            <TabsContent value="trial-balance">
              <Card>
                <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
                <CardContent>
                  {trialBalanceAccounts.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No posted journal entries found for this period</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left">Account</th>
                          <th className="px-4 py-3 text-right">Debit</th>
                          <th className="px-4 py-3 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceAccounts.map(b => (
                          <tr key={b.account_id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs text-muted-foreground mr-2">{b.account_code}</span>
                              {b.account_name}
                            </td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(b.debit_total)}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(b.credit_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t-2">
                          <td className="px-4 py-3">Total</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTBDebit)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalTBCredit)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-center">
                            {totalTBDebit === totalTBCredit ? (
                              <span className="text-success text-sm font-medium">✓ Trial Balance is in balance</span>
                            ) : (
                              <span className="text-destructive text-sm font-medium">✗ Out of balance by {formatCurrency(Math.abs(totalTBDebit - totalTBCredit))}</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pnl">
              <Card>
                <CardHeader><CardTitle>Profit & Loss Statement (Income Statement)</CardTitle></CardHeader>
                <CardContent>
                  {renderReportTable(revenueAccounts, 'Revenue', totalRevenue)}
                  {renderReportTable(expenseAccounts, 'Expenses', totalExpenses)}
                  <div className="border-t-2 border-foreground/30 pt-3 mt-4">
                    <div className="flex justify-between items-center px-4">
                      <span className="text-lg font-bold">Net Income</span>
                      <span className={cn('text-lg font-bold font-mono', netIncome >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatCurrency(netIncome)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balance-sheet">
              <Card>
                <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
                <CardContent>
                  {renderReportTable(assetAccounts, 'Assets', totalAssets)}
                  {renderReportTable(liabilityAccounts, 'Liabilities', totalLiabilities)}
                  
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Equity</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {equityAccounts.map(b => (
                          <tr key={b.account_id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 pl-4">
                              <span className="font-mono text-xs text-muted-foreground mr-2">{b.account_code}</span>
                              {b.account_name}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono">{formatCurrency(b.balance)}</td>
                          </tr>
                        ))}
                        <tr className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pl-4 italic">Net Income (Current Period)</td>
                          <td className="py-2 pr-4 text-right font-mono">{formatCurrency(netIncome)}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t-2 border-foreground/20">
                          <td className="py-2 pl-4">Total Equity</td>
                          <td className="py-2 pr-4 text-right font-mono">{formatCurrency(totalEquity)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="border-t-2 border-foreground/30 pt-3">
                    <div className="flex justify-between items-center px-4 mb-1">
                      <span className="font-bold">Total Liabilities + Equity</span>
                      <span className="font-bold font-mono">{formatCurrency(totalLiabilities + totalEquity)}</span>
                    </div>
                    <div className="text-center">
                      {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? (
                        <span className="text-success text-sm font-medium">✓ Balance Sheet is in balance</span>
                      ) : (
                        <span className="text-destructive text-sm font-medium">✗ Out of balance by {formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, ArrowRightLeft, Scale, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CashDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading: loading } = useQuery({
    queryKey: ['cash-dashboard'],
    queryFn: async () => {
      const [accounts, transfers, pendingTransfers, pendingRecon, transfersRes] = await Promise.all([
        supabase.from('bank_accounts').select('id, account_name, account_code, current_balance, currency, is_active').eq('is_active', true).order('account_name'),
        supabase.from('fund_transfers').select('id', { count: 'exact', head: true }),
        supabase.from('fund_transfers').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('bank_reconciliations').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('fund_transfers').select('id, transfer_number, amount, status, transfer_date, from_bank:bank_accounts!fund_transfers_from_bank_account_id_fkey(account_name), to_bank:bank_accounts!fund_transfers_to_bank_account_id_fkey(account_name)').order('created_at', { ascending: false }).limit(5),
      ]);
      const accts = accounts.data || [];
      const totalBal = accts.reduce((sum: number, a: any) => sum + (a.current_balance || 0), 0);
      return {
        metrics: { totalAccounts: accts.length, totalBalance: totalBal, pendingTransfers: pendingTransfers.count || 0, pendingReconciliations: pendingRecon.count || 0 },
        bankAccounts: accts,
        recentTransfers: transfersRes.data || [],
      };
    },
  });
  const metrics = data?.metrics || { totalAccounts: 0, totalBalance: 0, pendingTransfers: 0, pendingReconciliations: 0 };
  const bankAccounts = data?.bankAccounts || [];
  const recentTransfers = data?.recentTransfers || [];

  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Cash Management Dashboard" description="Bank accounts, transfers, and reconciliation overview." />

        {loading ? (
          <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : (
          <>
            <div className="card-grid">
              <div className="cursor-pointer" onClick={() => navigate('/bank-accounts')}><MetricCard title="Bank Accounts" value={metrics.totalAccounts} icon={Landmark} /></div>
              <MetricCard title="Total Balance" value={formatCurrency(metrics.totalBalance)} icon={TrendingUp} />
              <div className="cursor-pointer" onClick={() => navigate('/fund-transfers')}><MetricCard title="Pending Transfers" value={metrics.pendingTransfers} icon={ArrowRightLeft} /></div>
              <div className="cursor-pointer" onClick={() => navigate('/bank-reconciliation')}><MetricCard title="Open Reconciliations" value={metrics.pendingReconciliations} icon={Scale} /></div>
            </div>

            {/* Bank Account Balances Chart */}
            {bankAccounts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Account Balances</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={bankAccounts.map((a: any) => ({ name: a.account_name, balance: a.current_balance || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="balance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Bank Accounts</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/bank-accounts')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {bankAccounts.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No bank accounts yet</p>
                  ) : (
                    <div className="space-y-3">
                      {bankAccounts.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => navigate('/bank-accounts')}>
                          <div>
                            <p className="text-sm font-medium">{a.account_name}</p>
                            <p className="text-xs text-muted-foreground">{a.account_code}</p>
                          </div>
                          <span className="text-sm font-medium">{formatCurrency(a.current_balance || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent Transfers</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/fund-transfers')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {recentTransfers.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No transfers yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentTransfers.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => navigate('/fund-transfers')}>
                          <div>
                            <p className="text-sm font-medium">{t.transfer_number}</p>
                            <p className="text-xs text-muted-foreground">{(t.from_bank as any)?.account_name} → {(t.to_bank as any)?.account_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={t.status} />
                            <span className="text-xs font-medium">{formatCurrency(t.amount || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

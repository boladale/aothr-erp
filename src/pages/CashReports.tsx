import { useQuery } from '@tanstack/react-query';
import { Landmark, ArrowRightLeft, Scale, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/ui/metric-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CashReports() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalAccounts: 0, totalBalance: 0, totalTransfers: 0, reconciliations: 0 });
  const [balancesByAccount, setBalancesByAccount] = useState<{ name: string; balance: number; id: string }[]>([]);
  const [transfersByMonth, setTransfersByMonth] = useState<{ month: string; count: number; total: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const [accountsRes, transfersRes, reconcRes, txnsRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('is_active', true),
        supabase.from('fund_transfers').select('*'),
        supabase.from('bank_reconciliations').select('*'),
        supabase.from('bank_transactions').select('*, bank_accounts(account_name)').order('transaction_date', { ascending: false }).limit(50),
      ]);

      const accounts = accountsRes.data || [];
      const transfers = transfersRes.data || [];
      const recons = reconcRes.data || [];
      const txns = txnsRes.data || [];

      setMetrics({
        totalAccounts: accounts.length,
        totalBalance: accounts.reduce((s, a) => s + a.current_balance, 0),
        totalTransfers: transfers.length,
        reconciliations: recons.filter(r => r.status === 'completed').length,
      });

      setBalancesByAccount(accounts.map(a => ({ id: a.id, name: a.account_name, balance: a.current_balance })));

      // Transfers by month
      const monthMap: Record<string, { count: number; total: number }> = {};
      transfers.forEach(t => {
        const m = new Date(t.transfer_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        if (!monthMap[m]) monthMap[m] = { count: 0, total: 0 };
        monthMap[m].count++;
        monthMap[m].total += t.amount;
      });
      setTransfersByMonth(Object.entries(monthMap).map(([month, d]) => ({ month, ...d })));

      setRecentTransactions(txns.map(t => ({
        id: t.id,
        date: new Date(t.transaction_date).toLocaleDateString(),
        account: (t as any).bank_accounts?.account_name || '-',
        type: t.transaction_type,
        amount: t.amount,
        status: t.status,
        description: t.description || '-',
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Cash Management Reports" description="Bank balances, transfers, and transaction activity" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard title="Bank Accounts" value={metrics.totalAccounts} icon={Landmark} />
          <MetricCard title="Total Balance" value={`₦${metrics.totalBalance.toLocaleString()}`} icon={TrendingUp} />
          <MetricCard title="Fund Transfers" value={metrics.totalTransfers} icon={ArrowRightLeft} />
          <MetricCard title="Reconciliations" value={metrics.reconciliations} icon={Scale} />
        </div>

        <Tabs defaultValue="balances">
          <TabsList>
            <TabsTrigger value="balances">Account Balances</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card>
              <CardHeader><CardTitle>Bank Account Balances</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={balancesByAccount}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                      <Bar dataKey="balance" fill="hsl(217, 91%, 45%)" name="Balance" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers">
            <Card>
              <CardHeader><CardTitle>Fund Transfers by Month</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transfersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v: number, name: string) => name === 'total' ? `₦${v.toLocaleString()}` : v} />
                      <Bar dataKey="count" fill="hsl(142, 71%, 45%)" name="Count" />
                      <Bar dataKey="total" fill="hsl(38, 92%, 50%)" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader><CardTitle>Recent Bank Transactions</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'date', header: 'Date' },
                    { key: 'account', header: 'Account' },
                    { key: 'type', header: 'Type', render: (t: any) => <StatusBadge status={t.type} /> },
                    { key: 'amount', header: 'Amount', render: (t: any) => `₦${t.amount.toLocaleString()}` },
                    { key: 'description', header: 'Description' },
                    { key: 'status', header: 'Status', render: (t: any) => <StatusBadge status={t.status} /> },
                  ]}
                  data={recentTransactions}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

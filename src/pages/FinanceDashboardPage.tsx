import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { APDashboard } from '@/components/dashboard/APDashboard';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { Receipt, ArrowRight, BookOpen, Calculator, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142 76% 36%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)'];

function CFOMetrics() {
  const navigate = useNavigate();
  const { data, isLoading: loading } = useQuery({
    queryKey: ['finance-cfo-metrics'],
    queryFn: async () => {
      const [arInv, apInv, bankAccts, journalLines] = await Promise.all([
        supabase.from('ar_invoices').select('total_amount, payment_status'),
        supabase.from('ap_invoices').select('total_amount, payment_status'),
        supabase.from('bank_accounts').select('current_balance').eq('is_active', true),
        supabase.from('gl_journal_lines').select('debit, credit, account:gl_accounts(account_type)'),
      ]);

      const arTotal = (arInv.data || []).filter((i: any) => i.payment_status === 'unpaid').reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const apTotal = (apInv.data || []).filter((i: any) => i.payment_status === 'unpaid').reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
      const cashBal = (bankAccts.data || []).reduce((s: number, a: any) => s + (a.current_balance || 0), 0);

      let totalRevenue = 0, totalExpenses = 0;
      const expenseMap: Record<string, number> = {};
      (journalLines.data || []).forEach((l: any) => {
        const type = (l.account as any)?.account_type;
        if (type === 'revenue') totalRevenue += (l.credit - l.debit);
        if (type === 'expense') {
          totalExpenses += (l.debit - l.credit);
          expenseMap[type] = (expenseMap[type] || 0) + (l.debit - l.credit);
        }
      });

      const monthMap: Record<string, number> = {};
      (arInv.data || []).forEach((i: any) => {
        const month = new Date().toLocaleDateString('en', { month: 'short' });
        monthMap[month] = (monthMap[month] || 0) + (i.total_amount || 0);
      });

      return {
        totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses,
        totalAR: arTotal, totalAP: apTotal, cashBalance: cashBal,
        revenueByMonth: Object.entries(monthMap).map(([month, amount]) => ({ month, amount })),
        expenseByType: Object.entries(expenseMap).map(([name, value]) => ({ name, value })),
      };
    },
  });

  if (loading || !data) return <div className="card-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const summaryData = [
    { name: 'AR Outstanding', value: data.totalAR },
    { name: 'AP Outstanding', value: data.totalAP },
    { name: 'Cash Balance', value: data.cashBalance },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">CFO Overview</h2>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="cursor-pointer" onClick={() => navigate('/financial-reports')}>
          <MetricCard title="Total Revenue" value={formatCurrency(data.totalRevenue)} icon={TrendingUp} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/financial-reports')}>
          <MetricCard title="Total Expenses" value={formatCurrency(data.totalExpenses)} icon={TrendingDown} />
        </div>
        <MetricCard title="Net Income" value={formatCurrency(data.netIncome)} icon={DollarSign} />
        <div className="cursor-pointer" onClick={() => navigate('/ar-invoices')}>
          <MetricCard title="AR Outstanding" value={formatCurrency(data.totalAR)} icon={Receipt} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/ap-aging')}>
          <MetricCard title="AP Outstanding" value={formatCurrency(data.totalAP)} icon={Receipt} />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/bank-accounts')}>
          <MetricCard title="Cash Balance" value={formatCurrency(data.cashBalance)} icon={DollarSign} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summaryData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Revenue', value: data.totalRevenue || 1 },
                    { name: 'Expenses', value: data.totalExpenses || 1 },
                  ]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value"
                >
                  <Cell fill="hsl(142 76% 36%)" />
                  <Cell fill="hsl(0 84% 60%)" />
                </Pie>
                <Legend />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AROverview() {
  const navigate = useNavigate();
  const { data: ar, isLoading: loading } = useQuery({
    queryKey: ['finance-ar-overview'],
    queryFn: async () => {
      const [total, unpaid, receipts, cns, recent] = await Promise.all([
        supabase.from('ar_invoices').select('id', { count: 'exact', head: true }),
        supabase.from('ar_invoices').select('id', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
        supabase.from('ar_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('ar_credit_notes').select('id', { count: 'exact', head: true }),
        supabase.from('ar_invoices').select('id, invoice_number, status, total_amount, payment_status, customer:customers(name)').order('created_at', { ascending: false }).limit(5),
      ]);
      return {
        metrics: { totalInvoices: total.count || 0, unpaid: unpaid.count || 0, totalReceipts: receipts.count || 0, creditNotes: cns.count || 0 },
        recentInvoices: recent.data || [],
      };
    },
  });
  const metrics = ar?.metrics || { totalInvoices: 0, unpaid: 0, totalReceipts: 0, creditNotes: 0 };
  const recentInvoices = ar?.recentInvoices || [];

  if (loading) return <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Accounts Receivable Overview</h2>
      <div className="card-grid">
        <div className="cursor-pointer" onClick={() => navigate('/ar-invoices')}><MetricCard title="AR Invoices" value={metrics.totalInvoices} icon={Receipt} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/ar-invoices')}><MetricCard title="Unpaid Invoices" value={metrics.unpaid} icon={Receipt} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/ar-receipts')}><MetricCard title="Receipts" value={metrics.totalReceipts} icon={Receipt} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/ar-credit-notes')}><MetricCard title="Credit Notes" value={metrics.creditNotes} icon={Receipt} /></div>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent AR Invoices</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/ar-invoices')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No AR invoices yet</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => navigate('/ar-invoices')}>
                  <div>
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{(inv.customer as any)?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.payment_status} />
                    <span className="text-xs font-medium">{formatCurrency(inv.total_amount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GLOverview() {
  const navigate = useNavigate();
  const { data: metricsData, isLoading: loading } = useQuery({
    queryKey: ['finance-gl-overview'],
    queryFn: async () => {
      const [accounts, entries, drafts, periods] = await Promise.all([
        supabase.from('gl_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('gl_journal_entries').select('id', { count: 'exact', head: true }),
        supabase.from('gl_journal_entries').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('gl_fiscal_periods').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return { accounts: accounts.count || 0, entries: entries.count || 0, draftEntries: drafts.count || 0, openPeriods: periods.count || 0 };
    },
  });
  const metrics = metricsData || { accounts: 0, entries: 0, draftEntries: 0, openPeriods: 0 };

  if (loading) return <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">General Ledger Overview</h2>
      <div className="card-grid">
        <div className="cursor-pointer" onClick={() => navigate('/chart-of-accounts')}><MetricCard title="GL Accounts" value={metrics.accounts} icon={BookOpen} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/journal-entries')}><MetricCard title="Journal Entries" value={metrics.entries} icon={Calculator} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/journal-entries')}><MetricCard title="Draft Entries" value={metrics.draftEntries} icon={Calculator} /></div>
        <div className="cursor-pointer" onClick={() => navigate('/fiscal-periods')}><MetricCard title="Open Periods" value={metrics.openPeriods} icon={Calculator} /></div>
      </div>
    </div>
  );
}

export default function FinanceDashboardPage() {
  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Finance Dashboard" description="Accounts Payable, Accounts Receivable, and General Ledger overview." />
        <CFOMetrics />
        <GLOverview />
        <APDashboard />
        <AROverview />
      </div>
    </AppLayout>
  );
}

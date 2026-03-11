import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { APDashboard } from '@/components/dashboard/APDashboard';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { Receipt, Users, ArrowRight, BookOpen, Calculator } from 'lucide-react';

function AROverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalInvoices: 0, unpaid: 0, totalReceipts: 0, creditNotes: 0 });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [total, unpaid, receipts, cns, recent] = await Promise.all([
        supabase.from('ar_invoices').select('id', { count: 'exact', head: true }),
        supabase.from('ar_invoices').select('id', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
        supabase.from('ar_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('ar_credit_notes').select('id', { count: 'exact', head: true }),
        supabase.from('ar_invoices').select('id, invoice_number, status, total_amount, payment_status, customer:customers(name)').order('created_at', { ascending: false }).limit(5),
      ]);
      setMetrics({ totalInvoices: total.count || 0, unpaid: unpaid.count || 0, totalReceipts: receipts.count || 0, creditNotes: cns.count || 0 });
      setRecentInvoices(recent.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Accounts Receivable Overview</h2>
      <div className="card-grid">
        <MetricCard title="AR Invoices" value={metrics.totalInvoices} icon={Receipt} />
        <MetricCard title="Unpaid Invoices" value={metrics.unpaid} icon={Receipt} />
        <MetricCard title="Receipts" value={metrics.totalReceipts} icon={Receipt} />
        <MetricCard title="Credit Notes" value={metrics.creditNotes} icon={Receipt} />
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
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
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
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ accounts: 0, entries: 0, draftEntries: 0, openPeriods: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [accounts, entries, drafts, periods] = await Promise.all([
        supabase.from('gl_accounts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('gl_journal_entries').select('id', { count: 'exact', head: true }),
        supabase.from('gl_journal_entries').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('gl_fiscal_periods').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setMetrics({ accounts: accounts.count || 0, entries: entries.count || 0, draftEntries: drafts.count || 0, openPeriods: periods.count || 0 });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">General Ledger Overview</h2>
      <div className="card-grid">
        <MetricCard title="GL Accounts" value={metrics.accounts} icon={BookOpen} />
        <MetricCard title="Journal Entries" value={metrics.entries} icon={Calculator} />
        <MetricCard title="Draft Entries" value={metrics.draftEntries} icon={Calculator} />
        <MetricCard title="Open Periods" value={metrics.openPeriods} icon={Calculator} />
      </div>
    </div>
  );
}

export default function FinanceDashboardPage() {
  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Finance Dashboard" description="Accounts Payable, Accounts Receivable, and General Ledger overview." />
        <GLOverview />
        <APDashboard />
        <AROverview />
      </div>
    </AppLayout>
  );
}

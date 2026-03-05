import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';

export function APDashboard() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('accounts_payable');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalInvoices: 0,
    draftInvoices: 0,
    postedInvoices: 0,
    unresolvedHolds: 0,
    matchExceptions: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [activeHolds, setActiveHolds] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [totalInv, draftInv, postedInv, holds, exceptions, recentInvRes, activeHoldsRes] = await Promise.all([
        supabase.from('ap_invoices').select('id', { count: 'exact', head: true }),
        supabase.from('ap_invoices').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('ap_invoices').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
        supabase.from('invoice_holds').select('id', { count: 'exact', head: true }).is('resolved_at', null),
        supabase.from('match_runs').select('id', { count: 'exact', head: true }).eq('match_status', 'exceptions_found'),
        supabase.from('ap_invoices').select('id, invoice_number, status, total_amount, invoice_date, vendor:vendors(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('invoice_holds').select('id, hold_type, hold_reason, created_at, invoice:ap_invoices(invoice_number)').is('resolved_at', null).order('created_at', { ascending: false }).limit(5),
      ]);

      setMetrics({
        totalInvoices: totalInv.count || 0,
        draftInvoices: draftInv.count || 0,
        postedInvoices: postedInv.count || 0,
        unresolvedHolds: holds.count || 0,
        matchExceptions: exceptions.count || 0,
      });
      setRecentInvoices(recentInvRes.data || []);
      setActiveHolds(activeHoldsRes.data || []);
    } catch (error) {
      console.error('Error fetching AP dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Accounts Payable Overview</h2>
        <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Accounts Payable Overview</h2>

      <div className="card-grid">
        <MetricCard title="Total Invoices" value={metrics.totalInvoices} icon={Receipt} />
        <MetricCard title="Draft Invoices" value={metrics.draftInvoices} icon={Receipt} />
        <MetricCard title="Posted Invoices" value={metrics.postedInvoices} icon={CheckCircle2} />
        <MetricCard title="Unresolved Holds" value={metrics.unresolvedHolds} icon={ShieldAlert} />
      </div>

      {(metrics.unresolvedHolds > 0 || metrics.matchExceptions > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.unresolvedHolds > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <p className="text-sm font-medium">{metrics.unresolvedHolds} unresolved invoice holds</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>Resolve</Button>
              </CardContent>
            </Card>
          )}
          {metrics.matchExceptions > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium">{metrics.matchExceptions} match exceptions</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/match-exceptions')}>Review</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{(inv.vendor as any)?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status} />
                      <span className="text-xs font-medium">{formatCurrency(inv.total_amount || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Active Holds</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/match-exceptions')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeHolds.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No active holds</p>
            ) : (
              <div className="space-y-3">
                {activeHolds.map((hold: any) => (
                  <div key={hold.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{(hold.invoice as any)?.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{hold.hold_reason}</p>
                    </div>
                    <StatusBadge status={hold.hold_type} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

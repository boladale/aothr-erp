import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, BarChart3, FileSearch, ArrowRight, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalVendors: 0,
    activeVendors: 0,
    pendingVendors: 0,
    rejectedVendors: 0,
    totalRFPs: 0,
    openRFPs: 0,
  });
  const [recentVendors, setRecentVendors] = useState<any[]>([]);
  const [recentRFPs, setRecentRFPs] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [total, active, pending, rejected, totalRFPs, openRFPs, vendorsRes, rfpsRes] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true }),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('rfps').select('id', { count: 'exact', head: true }),
        supabase.from('rfps').select('id', { count: 'exact', head: true }).in('status', ['draft', 'published', 'evaluating']),
        supabase.from('vendors').select('id, code, name, status, city, country, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('rfps').select('id, rfp_number, title, status, deadline, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      setMetrics({
        totalVendors: total.count || 0,
        activeVendors: active.count || 0,
        pendingVendors: pending.count || 0,
        rejectedVendors: rejected.count || 0,
        totalRFPs: totalRFPs.count || 0,
        openRFPs: openRFPs.count || 0,
      });
      setRecentVendors(vendorsRes.data || []);
      setRecentRFPs(rfpsRes.data || []);
    } catch (error) {
      console.error('Error fetching vendor dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Vendor Management Dashboard" description="Overview of vendors, approvals, and RFPs." />

        {loading ? (
          <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : (
          <>
            <div className="card-grid">
              <MetricCard title="Total Vendors" value={metrics.totalVendors} icon={Building2} />
              <MetricCard title="Active Vendors" value={metrics.activeVendors} icon={CheckCircle2} />
              <MetricCard title="Pending Approval" value={metrics.pendingVendors} icon={AlertCircle} />
              <MetricCard title="Open RFPs" value={metrics.openRFPs} icon={FileSearch} />
            </div>

            {metrics.pendingVendors > 0 && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <p className="text-sm font-medium">{metrics.pendingVendors} vendor(s) awaiting approval</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/vendors')}>Review</Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent Vendors</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/vendors')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {recentVendors.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No vendors yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentVendors.map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => navigate('/vendors')}>
                          <div>
                            <p className="text-sm font-medium">{v.name}</p>
                            <p className="text-xs text-muted-foreground">{v.code} • {v.city || v.country || '—'}</p>
                          </div>
                          <StatusBadge status={v.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent RFPs</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/rfps')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {recentRFPs.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No RFPs yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentRFPs.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/rfps/${r.id}`)}>
                          <div>
                            <p className="text-sm font-medium">{r.rfp_number}</p>
                            <p className="text-xs text-muted-foreground">{r.title}</p>
                          </div>
                          <StatusBadge status={r.status} />
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, FileSearch, ClipboardList, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';

export function ProcurementDashboard() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('procurement_manager');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalPOs: 0,
    draftPOs: 0,
    pendingApprovalPOs: 0,
    sentPOs: 0,
    activeVendors: 0,
    pendingVendors: 0,
    openRFPs: 0,
    pendingRequisitions: 0,
  });
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [recentVendors, setRecentVendors] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        totalPOs, draftPOs, pendingPOs, sentPOs,
        activeVendors, pendingVendors, openRFPs, pendingReqs,
        recentPOsRes, recentVendorsRes
      ] = await Promise.all([
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('rfps').select('id', { count: 'exact', head: true }).in('status', ['draft', 'published', 'under_review']),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('purchase_orders').select('id, po_number, status, total_amount, created_at, vendor:vendors(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('vendors').select('id, code, name, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      setMetrics({
        totalPOs: totalPOs.count || 0,
        draftPOs: draftPOs.count || 0,
        pendingApprovalPOs: pendingPOs.count || 0,
        sentPOs: sentPOs.count || 0,
        activeVendors: activeVendors.count || 0,
        pendingVendors: pendingVendors.count || 0,
        openRFPs: openRFPs.count || 0,
        pendingRequisitions: pendingReqs.count || 0,
      });
      setRecentPOs((recentPOsRes.data || []).map((po: any) => ({ ...po, vendor: po.vendor as { name: string } | null })));
      setRecentVendors(recentVendorsRes.data || []);
    } catch (error) {
      console.error('Error fetching procurement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Procurement Overview</h2>
        <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Procurement Overview</h2>

      <div className="card-grid">
        <MetricCard title="Total Purchase Orders" value={metrics.totalPOs} icon={FileText} />
        <MetricCard title="Active Vendors" value={metrics.activeVendors} icon={Building2} />
        <MetricCard title="Open RFPs" value={metrics.openRFPs} icon={FileSearch} />
        {isManager && (
          <MetricCard title="Pending Approvals" value={metrics.pendingApprovalPOs + metrics.pendingVendors + metrics.pendingRequisitions} icon={AlertCircle} />
        )}
      </div>

      {/* Action alerts for managers */}
      {isManager && (metrics.pendingApprovalPOs > 0 || metrics.pendingVendors > 0 || metrics.pendingRequisitions > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.pendingApprovalPOs > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium">{metrics.pendingApprovalPOs} POs pending approval</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/purchase-orders')}>Review</Button>
              </CardContent>
            </Card>
          )}
          {metrics.pendingVendors > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium">{metrics.pendingVendors} vendors pending approval</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/vendors')}>Review</Button>
              </CardContent>
            </Card>
          )}
          {metrics.pendingRequisitions > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-warning" />
                  <p className="text-sm font-medium">{metrics.pendingRequisitions} requisitions pending</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/requisitions')}>Review</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent POs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentPOs.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No purchase orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentPOs.map(po => (
                  <div key={po.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                    <div>
                      <p className="text-sm font-medium">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground">{po.vendor?.name || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={po.status} />
                      <span className="text-xs font-medium">{formatCurrency(po.total_amount || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Vendors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Vendors</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/vendors')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
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
                      <p className="text-xs text-muted-foreground">{v.code}</p>
                    </div>
                    <StatusBadge status={v.status} />
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

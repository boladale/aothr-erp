import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Package, 
  FileText, 
  Truck, 
  Receipt, 
  AlertCircle,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

interface DashboardMetrics {
  activeVendors: number;
  pendingVendors: number;
  totalItems: number;
  openPOs: number;
  pendingReceipts: number;
  pendingInvoices: number;
  readyToClose: number;
}

interface RecentPO {
  id: string;
  po_number: string;
  vendor: { name: string } | null;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        activeVendors,
        pendingVendors,
        totalItems,
        openPOs,
        pendingReceipts,
        pendingInvoices,
        readyToClose,
        recent
      ] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['approved', 'sent', 'partially_received']),
        supabase.from('goods_receipts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('ap_invoices').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('close_ready', true).neq('status', 'closed'),
        supabase.from('purchase_orders').select('id, po_number, status, total_amount, created_at, vendor:vendors(name)').order('created_at', { ascending: false }).limit(5)
      ]);

      setMetrics({
        activeVendors: activeVendors.count || 0,
        pendingVendors: pendingVendors.count || 0,
        totalItems: totalItems.count || 0,
        openPOs: openPOs.count || 0,
        pendingReceipts: pendingReceipts.count || 0,
        pendingInvoices: pendingInvoices.count || 0,
        readyToClose: readyToClose.count || 0,
      });

      setRecentPOs((recent.data || []).map(po => ({
        ...po,
        vendor: po.vendor as { name: string } | null
      })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader 
          title={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}`}
          description="Here's what's happening with your operations today."
        />

        {/* Metrics Grid */}
        <div className="card-grid">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))
          ) : (
            <>
              <MetricCard
                title="Active Vendors"
                value={metrics?.activeVendors || 0}
                icon={Building2}
              />
              <MetricCard
                title="Total Items"
                value={metrics?.totalItems || 0}
                icon={Package}
              />
              <MetricCard
                title="Open Purchase Orders"
                value={metrics?.openPOs || 0}
                icon={FileText}
              />
              <MetricCard
                title="Ready to Close"
                value={metrics?.readyToClose || 0}
                icon={CheckCircle2}
              />
            </>
          )}
        </div>

        {/* Action Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {metrics?.pendingVendors ? (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">{metrics.pendingVendors} vendors pending approval</p>
                    <p className="text-sm text-muted-foreground">Review and approve</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/vendors')}>
                  View
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {metrics?.pendingReceipts ? (
            <Card className="border-info/30 bg-info/5">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-info" />
                  <div>
                    <p className="font-medium">{metrics.pendingReceipts} receipts to post</p>
                    <p className="text-sm text-muted-foreground">Draft GRNs waiting</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/goods-receipts')}>
                  View
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {metrics?.pendingInvoices ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{metrics.pendingInvoices} invoices to post</p>
                    <p className="text-sm text-muted-foreground">Awaiting review</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                  View
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Recent POs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Purchase Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentPOs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No purchase orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentPOs.map(po => (
                  <div
                    key={po.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{po.po_number}</p>
                        <p className="text-sm text-muted-foreground">{po.vendor?.name || 'Unknown Vendor'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={po.status} />
                      <span className="text-sm font-medium">
                        ₦{(po.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

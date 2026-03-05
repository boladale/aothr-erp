import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Boxes, AlertCircle, ArrowRight, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';

export function WarehouseDashboard() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('warehouse_manager');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalGRNs: 0,
    draftGRNs: 0,
    postedGRNs: 0,
    lowStockItems: 0,
    totalLocations: 0,
    activeReservations: 0,
  });
  const [recentGRNs, setRecentGRNs] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [totalGRNs, draftGRNs, postedGRNs, totalLocations, activeReservations, recentGRNsRes, lowStockRes] = await Promise.all([
        supabase.from('goods_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('goods_receipts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('goods_receipts').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
        supabase.from('locations').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('inventory_reservations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('goods_receipts').select('id, grn_number, status, receipt_date, created_at, purchase_order:purchase_orders(po_number), location:locations(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('inventory_balances').select('id, quantity, item:items(name, code), location:locations(name)').lt('quantity', 10).order('quantity', { ascending: true }).limit(5),
      ]);

      setMetrics({
        totalGRNs: totalGRNs.count || 0,
        draftGRNs: draftGRNs.count || 0,
        postedGRNs: postedGRNs.count || 0,
        lowStockItems: lowStockRes.data?.length || 0,
        totalLocations: totalLocations.count || 0,
        activeReservations: activeReservations.count || 0,
      });
      setRecentGRNs(recentGRNsRes.data || []);
      setLowStockItems(lowStockRes.data || []);
    } catch (error) {
      console.error('Error fetching warehouse dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Warehouse Overview</h2>
        <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Warehouse Overview</h2>

      <div className="card-grid">
        <MetricCard title="Total GRNs" value={metrics.totalGRNs} icon={Truck} />
        <MetricCard title="Draft GRNs" value={metrics.draftGRNs} icon={Truck} />
        <MetricCard title="Active Locations" value={metrics.totalLocations} icon={Boxes} />
        <MetricCard title="Active Reservations" value={metrics.activeReservations} icon={Package} />
      </div>

      {metrics.draftGRNs > 0 && (
        <Card className="border-info/30 bg-info/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-info" />
              <p className="text-sm font-medium">{metrics.draftGRNs} goods receipts awaiting posting</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/goods-receipts')}>
              {isManager ? 'Post' : 'View'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Goods Receipts</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/goods-receipts')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentGRNs.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No goods receipts yet</p>
            ) : (
              <div className="space-y-3">
                {recentGRNs.map((grn: any) => (
                  <div key={grn.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{grn.grn_number}</p>
                      <p className="text-xs text-muted-foreground">{(grn.purchase_order as any)?.po_number} → {(grn.location as any)?.name}</p>
                    </div>
                    <StatusBadge status={grn.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Low Stock Items</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No low stock items</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{(item.item as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{(item.location as any)?.name}</p>
                    </div>
                    <span className="text-sm font-medium text-destructive">{item.quantity} units</span>
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

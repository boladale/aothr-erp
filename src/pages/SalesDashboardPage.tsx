import { useEffect, useState } from 'react';
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
import { FileCheck, ShoppingCart, Truck, ArrowRight, DollarSign } from 'lucide-react';

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalQuotations: 0, draftQuotations: 0,
    totalOrders: 0, confirmedOrders: 0,
    totalDeliveries: 0, pendingDeliveries: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentQuotations, setRecentQuotations] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tq, dq, to, co, td, pd, ordersRes, quotesRes] = await Promise.all([
        supabase.from('sales_quotations').select('id', { count: 'exact', head: true }),
        supabase.from('sales_quotations').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }),
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('delivery_notes').select('id', { count: 'exact', head: true }),
        supabase.from('delivery_notes').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('sales_orders').select('id, order_number, status, total_amount, customer:customers(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('sales_quotations').select('id, quotation_number, status, total_amount, customer:customers(name)').order('created_at', { ascending: false }).limit(5),
      ]);
      setMetrics({
        totalQuotations: tq.count || 0, draftQuotations: dq.count || 0,
        totalOrders: to.count || 0, confirmedOrders: co.count || 0,
        totalDeliveries: td.count || 0, pendingDeliveries: pd.count || 0,
      });
      setRecentOrders(ordersRes.data || []);
      setRecentQuotations(quotesRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Sales Dashboard" description="Quotations, sales orders, and deliveries overview." />

        {loading ? (
          <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : (
          <>
            <div className="card-grid">
              <MetricCard title="Quotations" value={metrics.totalQuotations} icon={FileCheck} />
              <MetricCard title="Sales Orders" value={metrics.totalOrders} icon={ShoppingCart} />
              <MetricCard title="Confirmed Orders" value={metrics.confirmedOrders} icon={DollarSign} />
              <MetricCard title="Pending Deliveries" value={metrics.pendingDeliveries} icon={Truck} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent Quotations</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/sales-quotations')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {recentQuotations.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No quotations yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentQuotations.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="text-sm font-medium">{q.quotation_number}</p>
                            <p className="text-xs text-muted-foreground">{(q.customer as any)?.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={q.status} />
                            <span className="text-xs font-medium">{formatCurrency(q.total_amount || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Recent Sales Orders</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/sales-orders')}>View All <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {recentOrders.length === 0 ? (
                    <p className="text-center py-6 text-sm text-muted-foreground">No sales orders yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentOrders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="text-sm font-medium">{o.order_number}</p>
                            <p className="text-xs text-muted-foreground">{(o.customer as any)?.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={o.status} />
                            <span className="text-xs font-medium">{formatCurrency(o.total_amount || 0)}</span>
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

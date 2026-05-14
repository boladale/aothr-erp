import { useQuery } from '@tanstack/react-query';
import { Boxes, TrendingUp, AlertTriangle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/ui/metric-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(217, 91%, 45%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(199, 89%, 48%)'];

export default function WarehouseReports() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['warehouse-reports'],
    queryFn: async () => {
      const [balancesRes, grnsRes, locationsRes, itemsRes] = await Promise.all([
        supabase.from('inventory_balances').select('*, items(name), locations(name)'),
        supabase.from('goods_receipts').select('id, receipt_date, status'),
        supabase.from('locations').select('id, name').eq('is_active', true),
        supabase.from('items').select('id, name').eq('is_active', true),
      ]);

      const balances = balancesRes.data || [];
      const grns = grnsRes.data || [];
      const locations = locationsRes.data || [];
      const items = itemsRes.data || [];

      const lowStock = balances.filter(b => b.quantity <= 10).length;
      const metrics = {
        totalItems: items.length,
        totalLocations: locations.length,
        totalGRNs: grns.length,
        lowStockItems: lowStock,
      };

      const locMap: Record<string, { totalQty: number; items: Set<string> }> = {};
      balances.forEach(b => {
        const locName = (b as any).locations?.name || 'Unknown';
        if (!locMap[locName]) locMap[locName] = { totalQty: 0, items: new Set() };
        locMap[locName].totalQty += b.quantity;
        locMap[locName].items.add(b.item_id);
      });
      const inventoryByLocation = Object.entries(locMap).map(([location, d]) => ({ location, totalQty: d.totalQty, items: d.items.size }));

      const monthMap: Record<string, number> = {};
      grns.forEach(g => {
        const m = new Date(g.receipt_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        monthMap[m] = (monthMap[m] || 0) + 1;
      });
      const grnsByMonth = Object.entries(monthMap).map(([month, count]) => ({ month, count }));

      const itemMap: Record<string, { name: string; totalQty: number }> = {};
      balances.forEach(b => {
        const name = (b as any).items?.name || 'Unknown';
        if (!itemMap[b.item_id]) itemMap[b.item_id] = { name, totalQty: 0 };
        itemMap[b.item_id].totalQty += b.quantity;
      });
      const topItems = Object.entries(itemMap).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.totalQty - a.totalQty).slice(0, 15);

      return { metrics, inventoryByLocation, grnsByMonth, topItems };
    },
  });

  const metrics = data?.metrics || { totalItems: 0, totalLocations: 0, totalGRNs: 0, lowStockItems: 0 };
  const inventoryByLocation = data?.inventoryByLocation || [];
  const grnsByMonth = data?.grnsByMonth || [];
  const topItems = data?.topItems || [];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Warehouse Reports" description="Inventory levels, goods receipts, and stock analytics" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard title="Active Items" value={metrics.totalItems} icon={Boxes} />
          <MetricCard title="Locations" value={metrics.totalLocations} icon={MapPin} />
          <MetricCard title="Total GRNs" value={metrics.totalGRNs} icon={TrendingUp} />
          <MetricCard title="Low Stock Items" value={metrics.lowStockItems} icon={AlertTriangle} />
        </div>

        <Tabs defaultValue="by-location">
          <TabsList>
            <TabsTrigger value="by-location">By Location</TabsTrigger>
            <TabsTrigger value="grn-trend">GRN Trends</TabsTrigger>
            <TabsTrigger value="top-items">Top Items</TabsTrigger>
          </TabsList>

          <TabsContent value="by-location">
            <Card>
              <CardHeader><CardTitle>Inventory by Location</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryByLocation}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="totalQty" fill="hsl(217, 91%, 45%)" name="Total Quantity" />
                      <Bar dataKey="items" fill="hsl(142, 71%, 45%)" name="Unique Items" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grn-trend">
            <Card>
              <CardHeader><CardTitle>Goods Receipts by Month</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grnsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(199, 89%, 48%)" name="GRN Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-items">
            <Card>
              <CardHeader><CardTitle>Top 15 Items by Stock Quantity</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Item', render: (i: any) => <span className="font-medium">{i.name}</span> },
                    { key: 'totalQty', header: 'Total Qty', render: (i: any) => i.totalQty.toLocaleString() },
                  ]}
                  data={topItems}
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

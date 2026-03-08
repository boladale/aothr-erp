import { useEffect, useState } from 'react';
import { BarChart3, FileText, TrendingUp, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/ui/metric-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(217, 91%, 45%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(199, 89%, 48%)'];

export default function ProcurementReports() {
  const [loading, setLoading] = useState(true);
  const [posByStatus, setPosByStatus] = useState<{ status: string; count: number }[]>([]);
  const [posByMonth, setPosByMonth] = useState<{ month: string; count: number; total: number }[]>([]);
  const [topVendors, setTopVendors] = useState<{ name: string; total: number; po_count: number }[]>([]);
  const [reqsByStatus, setReqsByStatus] = useState<{ status: string; count: number }[]>([]);
  const [rfpSummary, setRfpSummary] = useState<{ status: string; count: number }[]>([]);
  const [metrics, setMetrics] = useState({ totalPOs: 0, totalValue: 0, avgPOValue: 0, pendingApproval: 0 });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const [posRes, reqsRes, rfpsRes, vendorsRes] = await Promise.all([
        supabase.from('purchase_orders').select('id, status, order_date, total_amount, vendor_id, vendors(name)'),
        supabase.from('requisitions').select('id, status'),
        supabase.from('rfps').select('id, status'),
        supabase.from('vendors').select('id, name'),
      ]);

      const pos = posRes.data || [];
      const reqs = reqsRes.data || [];
      const rfps = rfpsRes.data || [];

      // Metrics
      const totalValue = pos.reduce((s, p) => s + (p.total_amount || 0), 0);
      setMetrics({
        totalPOs: pos.length,
        totalValue,
        avgPOValue: pos.length > 0 ? totalValue / pos.length : 0,
        pendingApproval: pos.filter(p => p.status === 'pending_approval').length,
      });

      // POs by status
      const statusMap: Record<string, number> = {};
      pos.forEach(p => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });
      setPosByStatus(Object.entries(statusMap).map(([status, count]) => ({ status, count })));

      // POs by month
      const monthMap: Record<string, { count: number; total: number }> = {};
      pos.forEach(p => {
        const m = new Date(p.order_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        if (!monthMap[m]) monthMap[m] = { count: 0, total: 0 };
        monthMap[m].count++;
        monthMap[m].total += p.total_amount || 0;
      });
      setPosByMonth(Object.entries(monthMap).map(([month, d]) => ({ month, ...d })));

      // Top vendors by PO value
      const vendorTotals: Record<string, { name: string; total: number; po_count: number }> = {};
      pos.forEach(p => {
        const vName = (p as any).vendors?.name || 'Unknown';
        if (!vendorTotals[p.vendor_id]) vendorTotals[p.vendor_id] = { name: vName, total: 0, po_count: 0 };
        vendorTotals[p.vendor_id].total += p.total_amount || 0;
        vendorTotals[p.vendor_id].po_count++;
      });
      setTopVendors(Object.values(vendorTotals).sort((a, b) => b.total - a.total).slice(0, 10));

      // Requisitions by status
      const reqStatusMap: Record<string, number> = {};
      reqs.forEach(r => { reqStatusMap[r.status] = (reqStatusMap[r.status] || 0) + 1; });
      setReqsByStatus(Object.entries(reqStatusMap).map(([status, count]) => ({ status, count })));

      // RFPs
      const rfpStatusMap: Record<string, number> = {};
      rfps.forEach(r => { rfpStatusMap[r.status] = (rfpStatusMap[r.status] || 0) + 1; });
      setRfpSummary(Object.entries(rfpStatusMap).map(([status, count]) => ({ status, count })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Procurement Reports" description="Purchase orders, requisitions, RFPs, and vendor analytics" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard title="Total POs" value={metrics.totalPOs} icon={FileText} />
          <MetricCard title="Total PO Value" value={`₦${metrics.totalValue.toLocaleString()}`} icon={TrendingUp} />
          <MetricCard title="Avg PO Value" value={`₦${metrics.avgPOValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={BarChart3} />
          <MetricCard title="Pending Approval" value={metrics.pendingApproval} icon={Package} />
        </div>

        <Tabs defaultValue="po-trend">
          <TabsList>
            <TabsTrigger value="po-trend">PO Trends</TabsTrigger>
            <TabsTrigger value="po-status">PO by Status</TabsTrigger>
            <TabsTrigger value="vendors">Top Vendors</TabsTrigger>
            <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
            <TabsTrigger value="rfps">RFPs</TabsTrigger>
          </TabsList>

          <TabsContent value="po-trend">
            <Card>
              <CardHeader><CardTitle>Purchase Orders by Month</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={posByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(v: number, name: string) => name === 'total' ? `₦${v.toLocaleString()}` : v} />
                      <Bar yAxisId="left" dataKey="count" fill="hsl(217, 91%, 45%)" name="Count" />
                      <Bar yAxisId="right" dataKey="total" fill="hsl(142, 71%, 45%)" name="Total Value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po-status">
            <Card>
              <CardHeader><CardTitle>PO Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={posByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={120} label>
                        {posByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors">
            <Card>
              <CardHeader><CardTitle>Top 10 Vendors by PO Value</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Vendor', render: (v: any) => <span className="font-medium">{v.name}</span> },
                    { key: 'po_count', header: 'PO Count' },
                    { key: 'total', header: 'Total Value', render: (v: any) => `₦${v.total.toLocaleString()}` },
                  ]}
                  data={topVendors.map((v, i) => ({ ...v, id: String(i) }))}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requisitions">
            <Card>
              <CardHeader><CardTitle>Requisitions by Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reqsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={120} label>
                        {reqsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rfps">
            <Card>
              <CardHeader><CardTitle>RFP Status Summary</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                    { key: 'count', header: 'Count' },
                  ]}
                  data={rfpSummary.map((r, i) => ({ ...r, id: String(i) }))}
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

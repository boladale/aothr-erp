import { useQuery } from '@tanstack/react-query';
import { Receipt, ArrowDownToLine, FileX, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/ui/metric-card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(217, 91%, 45%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(199, 89%, 48%)'];

export default function FinanceARReports() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['finance-ar-reports'],
    queryFn: async () => {
      const [invRes, recRes, cnRes] = await Promise.all([
        supabase.from('ar_invoices').select('*, customers(name)'),
        supabase.from('ar_receipts').select('*'),
        supabase.from('ar_credit_notes').select('*'),
      ]);
      const invoices = invRes.data || [];
      const receipts = recRes.data || [];
      const credits = cnRes.data || [];

      const metrics = {
        totalInvoices: invoices.length,
        totalRevenue: invoices.reduce((s, i) => s + (i.total_amount || 0), 0),
        totalReceipts: receipts.reduce((s, r) => s + (r.total_amount || 0), 0),
        totalCredits: credits.reduce((s, c) => s + (c.total_amount || 0), 0),
      };

      const statusMap: Record<string, number> = {};
      invoices.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
      const invoicesByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      const monthMap: Record<string, { invoiced: number; received: number }> = {};
      invoices.forEach(i => {
        const m = new Date(i.invoice_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        if (!monthMap[m]) monthMap[m] = { invoiced: 0, received: 0 };
        monthMap[m].invoiced += i.total_amount || 0;
      });
      receipts.forEach(r => {
        const m = new Date(r.receipt_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        if (!monthMap[m]) monthMap[m] = { invoiced: 0, received: 0 };
        monthMap[m].received += r.total_amount || 0;
      });
      const revenueByMonth = Object.entries(monthMap).map(([month, d]) => ({ month, ...d }));

      const custMap: Record<string, { name: string; total: number; count: number }> = {};
      invoices.forEach(i => {
        const name = (i as any).customers?.name || 'Unknown';
        if (!custMap[i.customer_id]) custMap[i.customer_id] = { name, total: 0, count: 0 };
        custMap[i.customer_id].total += i.total_amount || 0;
        custMap[i.customer_id].count++;
      });
      const topCustomers = Object.entries(custMap).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.total - a.total).slice(0, 10);

      return { metrics, invoicesByStatus, revenueByMonth, topCustomers };
    },
  });

  const metrics = data?.metrics || { totalInvoices: 0, totalRevenue: 0, totalReceipts: 0, totalCredits: 0 };
  const invoicesByStatus = data?.invoicesByStatus || [];
  const revenueByMonth = data?.revenueByMonth || [];
  const topCustomers = data?.topCustomers || [];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AR Reports" description="Accounts receivable invoices, receipts, and customer analytics" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard title="AR Invoices" value={metrics.totalInvoices} icon={Receipt} />
          <MetricCard title="Total Revenue" value={`₦${metrics.totalRevenue.toLocaleString()}`} icon={ArrowDownToLine} />
          <MetricCard title="Total Receipts" value={`₦${metrics.totalReceipts.toLocaleString()}`} icon={ArrowDownToLine} />
          <MetricCard title="Credit Notes" value={`₦${metrics.totalCredits.toLocaleString()}`} icon={FileX} />
        </div>

        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
            <TabsTrigger value="status">Invoice Status</TabsTrigger>
            <TabsTrigger value="customers">Top Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <Card>
              <CardHeader><CardTitle>Invoiced vs Received by Month</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => `₦${v.toLocaleString()}`} />
                      <Bar dataKey="invoiced" fill="hsl(217, 91%, 45%)" name="Invoiced" />
                      <Bar dataKey="received" fill="hsl(142, 71%, 45%)" name="Received" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader><CardTitle>AR Invoice Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={invoicesByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={120} label>
                        {invoicesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader><CardTitle>Top 10 Customers by Revenue</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Customer', render: (c: any) => <span className="font-medium">{c.name}</span> },
                    { key: 'count', header: 'Invoices' },
                    { key: 'total', header: 'Total Revenue', render: (c: any) => `₦${c.total.toLocaleString()}` },
                  ]}
                  data={topCustomers}
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

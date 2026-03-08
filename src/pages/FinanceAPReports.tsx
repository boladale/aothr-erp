import { useEffect, useState } from 'react';
import { Receipt, CreditCard, Clock, TrendingDown } from 'lucide-react';
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

export default function FinanceAPReports() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalInvoices: 0, totalValue: 0, unpaid: 0, overdue: 0 });
  const [invoicesByStatus, setInvoicesByStatus] = useState<{ status: string; count: number }[]>([]);
  const [invoicesByMonth, setInvoicesByMonth] = useState<{ month: string; count: number; total: number }[]>([]);
  const [paymentsByMethod, setPaymentsByMethod] = useState<{ method: string; count: number; total: number }[]>([]);
  const [topVendorsByInvoice, setTopVendorsByInvoice] = useState<{ name: string; total: number; count: number; id: string }[]>([]);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase.from('ap_invoices').select('*, vendors(name)'),
        supabase.from('ap_payments').select('*'),
      ]);

      const invoices = invoicesRes.data || [];
      const payments = paymentsRes.data || [];
      const today = new Date().toISOString().split('T')[0];

      const totalValue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
      const unpaid = invoices.filter(i => i.payment_status === 'unpaid').reduce((s, i) => s + (i.total_amount || 0), 0);
      const overdue = invoices.filter(i => i.due_date && i.due_date < today && i.payment_status !== 'paid').length;

      setMetrics({ totalInvoices: invoices.length, totalValue, unpaid, overdue });

      // By status
      const statusMap: Record<string, number> = {};
      invoices.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
      setInvoicesByStatus(Object.entries(statusMap).map(([status, count]) => ({ status, count })));

      // By month
      const monthMap: Record<string, { count: number; total: number }> = {};
      invoices.forEach(i => {
        const m = new Date(i.invoice_date).toLocaleDateString('en', { year: 'numeric', month: 'short' });
        if (!monthMap[m]) monthMap[m] = { count: 0, total: 0 };
        monthMap[m].count++;
        monthMap[m].total += i.total_amount || 0;
      });
      setInvoicesByMonth(Object.entries(monthMap).map(([month, d]) => ({ month, ...d })));

      // Payments by method
      const methodMap: Record<string, { count: number; total: number }> = {};
      payments.forEach(p => {
        if (!methodMap[p.payment_method]) methodMap[p.payment_method] = { count: 0, total: 0 };
        methodMap[p.payment_method].count++;
        methodMap[p.payment_method].total += p.total_amount || 0;
      });
      setPaymentsByMethod(Object.entries(methodMap).map(([method, d]) => ({ method: method.replace(/_/g, ' '), ...d })));

      // Top vendors
      const vendorMap: Record<string, { name: string; total: number; count: number }> = {};
      invoices.forEach(i => {
        const name = (i as any).vendors?.name || 'Unknown';
        if (!vendorMap[i.vendor_id]) vendorMap[i.vendor_id] = { name, total: 0, count: 0 };
        vendorMap[i.vendor_id].total += i.total_amount || 0;
        vendorMap[i.vendor_id].count++;
      });
      setTopVendorsByInvoice(Object.entries(vendorMap).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.total - a.total).slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AP Reports" description="Accounts payable invoices, payments, and vendor analysis" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <MetricCard title="Total Invoices" value={metrics.totalInvoices} icon={Receipt} />
          <MetricCard title="Total Value" value={`₦${metrics.totalValue.toLocaleString()}`} icon={CreditCard} />
          <MetricCard title="Unpaid Balance" value={`₦${metrics.unpaid.toLocaleString()}`} icon={TrendingDown} />
          <MetricCard title="Overdue Invoices" value={metrics.overdue} icon={Clock} />
        </div>

        <Tabs defaultValue="trend">
          <TabsList>
            <TabsTrigger value="trend">Invoice Trends</TabsTrigger>
            <TabsTrigger value="status">By Status</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="vendors">Top Vendors</TabsTrigger>
          </TabsList>

          <TabsContent value="trend">
            <Card>
              <CardHeader><CardTitle>AP Invoices by Month</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invoicesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(v: number, name: string) => name === 'total' ? `₦${v.toLocaleString()}` : v} />
                      <Bar dataKey="count" fill="hsl(217, 91%, 45%)" name="Count" />
                      <Bar dataKey="total" fill="hsl(0, 72%, 51%)" name="Total Value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader><CardTitle>Invoice Status Distribution</CardTitle></CardHeader>
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

          <TabsContent value="payments">
            <Card>
              <CardHeader><CardTitle>Payments by Method</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'method', header: 'Method', render: (p: any) => <span className="font-medium capitalize">{p.method}</span> },
                    { key: 'count', header: 'Count' },
                    { key: 'total', header: 'Total', render: (p: any) => `₦${p.total.toLocaleString()}` },
                  ]}
                  data={paymentsByMethod.map((p, i) => ({ ...p, id: String(i) }))}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors">
            <Card>
              <CardHeader><CardTitle>Top 10 Vendors by Invoice Value</CardTitle></CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Vendor', render: (v: any) => <span className="font-medium">{v.name}</span> },
                    { key: 'count', header: 'Invoices' },
                    { key: 'total', header: 'Total', render: (v: any) => `₦${v.total.toLocaleString()}` },
                  ]}
                  data={topVendorsByInvoice}
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

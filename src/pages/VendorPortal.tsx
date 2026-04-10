import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { MetricCard } from '@/components/ui/metric-card';
import { FileText, CreditCard, DollarSign, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

export default function VendorPortal() {
  const { user } = useAuth();

  const { data: vendorUser } = useQuery({
    queryKey: ['my-vendor-user', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_users').select('*, vendors(id, name, code, email, status)').eq('user_id', user!.id).eq('is_active', true).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const vendorId = (vendorUser as any)?.vendors?.id;

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['vendor-pos', vendorId],
    queryFn: async () => {
      const { data } = await supabase.from('purchase_orders').select('*').eq('vendor_id', vendorId!).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!vendorId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['vendor-invoices', vendorId],
    queryFn: async () => {
      const { data } = await supabase.from('ap_invoices').select('*').eq('vendor_id', vendorId!).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!vendorId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['vendor-payments', vendorId],
    queryFn: async () => {
      const { data } = await supabase.from('ap_payments').select('*').eq('vendor_id', vendorId!).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!vendorId,
  });

  if (!vendorUser) {
    return (
      <AppLayout>
        <div className="page-container py-16 text-center space-y-4">
          <h2 className="text-xl font-semibold">Vendor Portal</h2>
          <p className="text-muted-foreground">Your account is not linked to a vendor record. Please contact the organization administrator.</p>
        </div>
      </AppLayout>
    );
  }

  const vendor = (vendorUser as any).vendors;
  const totalPOValue = purchaseOrders.reduce((s: number, po: any) => s + Number(po.total_amount || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Vendor Portal" description={`Welcome, ${vendor?.name}`} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Purchase Orders" value={purchaseOrders.length} icon={ShoppingCart} />
          <MetricCard title="PO Value" value={totalPOValue.toLocaleString()} icon={FileText} />
          <MetricCard title="Invoices" value={invoices.length} icon={FileText} />
          <MetricCard title="Payments Received" value={totalPaid.toLocaleString()} icon={DollarSign} />
        </div>

        <Tabs defaultValue="pos">
          <TabsList>
            <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="pos">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow>
                  ) : purchaseOrders.map((po: any) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono">{po.po_number}</TableCell>
                      <TableCell>{format(new Date(po.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{Number(po.total_amount).toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={po.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="invoices">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No invoices</TableCell></TableRow>
                  ) : invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                      <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{Number(inv.total_amount).toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={inv.payment_status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments</TableCell></TableRow>
                  ) : payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.payment_number}</TableCell>
                      <TableCell>{format(new Date(p.payment_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{Number(p.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{p.payment_method}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

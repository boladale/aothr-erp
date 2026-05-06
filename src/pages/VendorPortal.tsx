import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/ui/metric-card';
import { FileText, DollarSign, ShoppingCart, Send, ClipboardCheck, ClipboardList, User } from 'lucide-react';
import { VendorRFPBidding } from '@/components/vendor-portal/VendorRFPBidding';
import { VendorProfilePanel } from '@/components/vendor-portal/VendorProfilePanel';
import { VendorPOAcceptance } from '@/components/vendor-portal/VendorPOAcceptance';
import { VendorInvoiceSubmission } from '@/components/vendor-portal/VendorInvoiceSubmission';
import { VendorQuoteRequests } from '@/components/vendor-portal/VendorQuoteRequests';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { format } from 'date-fns';

export default function VendorPortal() {
  const { user } = useAuth();

  const { data: vendorUser } = useQuery({
    queryKey: ['my-vendor-user', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_users' as any).select('*, vendors(id, name, code, email, status)').eq('user_id', user!.id).eq('is_active', true).maybeSingle();
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

        <Tabs defaultValue="quotes">
          <TabsList className="flex-wrap">
            <TabsTrigger value="quotes" className="gap-1"><ClipboardList className="h-4 w-4" /> Quote Requests</TabsTrigger>
            <TabsTrigger value="rfps" className="gap-1"><Send className="h-4 w-4" /> RFPs & Bidding</TabsTrigger>
            <TabsTrigger value="pos" className="gap-1"><ClipboardCheck className="h-4 w-4" /> Purchase Orders</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1"><FileText className="h-4 w-4" /> Invoices</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1"><DollarSign className="h-4 w-4" /> Payments</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" /> Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes">
            <VendorQuoteRequests vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="rfps">
            <VendorRFPBidding vendorId={vendorId} userId={user!.id} />
          </TabsContent>

          <TabsContent value="pos">
            <VendorPOAcceptance vendorId={vendorId} userId={user!.id} purchaseOrders={purchaseOrders} />
          </TabsContent>

          <TabsContent value="invoices">
            <VendorInvoiceSubmission vendorId={vendorId} userId={user!.id} invoices={invoices} purchaseOrders={purchaseOrders} />
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

          <TabsContent value="profile">
            <VendorProfilePanel userId={user!.id} vendorUser={vendorUser} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

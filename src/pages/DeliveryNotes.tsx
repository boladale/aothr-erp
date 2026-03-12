import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { AttachmentPanel } from '@/components/attachments/AttachmentPanel';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { Receipt } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function DeliveryNotes() {
  const { user, organizationId } = useAuth();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailLines, setDetailLines] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('delivery_notes')
      .select('*, customers(name), sales_orders(order_number), locations(name)')
      .order('created_at', { ascending: false });
    setDeliveries(data || []);
    setLoading(false);
  };

  const viewDetail = async (dn: any) => {
    const { data } = await supabase.from('delivery_note_lines')
      .select('*, items(name, code), sales_order_lines(description, quantity, unit_price)')
      .eq('dn_id', dn.id);
    setDetailLines(data || []);
    setDetail(dn);
  };

  const handleGenerateInvoice = async (dn: any) => {
    // Get DN lines with SO line details
    const { data: dnLines } = await supabase.from('delivery_note_lines')
      .select('*, sales_order_lines(item_id, description, unit_price)')
      .eq('dn_id', dn.id);
    if (!dnLines || dnLines.length === 0) return toast.error('No lines to invoice');

    // Get the SO to get tax info
    const { data: so } = await supabase.from('sales_orders').select('*').eq('id', dn.order_id).single();

    const invNumber = await getNextTransactionNumber(organizationId!, 'AR_INV', 'INV');
    const subtotal = dnLines.reduce((s: number, l: any) => s + (l.qty_delivered * (l.sales_order_lines?.unit_price || 0)), 0);

    const { data: inv, error } = await supabase.from('ar_invoices').insert({
      invoice_number: invNumber,
      customer_id: dn.customer_id,
      subtotal,
      total_amount: subtotal + (so?.tax_amount || 0),
      tax_amount: so?.tax_amount || 0,
      notes: `Generated from DN ${dn.dn_number}`,
      created_by: user?.id, organization_id: organizationId,
    }).select().single();

    if (error) return toast.error(error.message);

    // Create invoice lines
    await supabase.from('ar_invoice_lines').insert(dnLines.map((l: any, i: number) => ({
      invoice_id: inv.id,
      description: l.sales_order_lines?.description || 'Delivered item',
      item_id: l.sales_order_lines?.item_id || l.item_id,
      quantity: l.qty_delivered,
      unit_price: l.sales_order_lines?.unit_price || 0,
    })));

    // Update SO line qty_invoiced
    for (const l of dnLines) {
      const { data: currentLine } = await supabase.from('sales_order_lines').select('qty_invoiced').eq('id', l.order_line_id).single();
      await supabase.from('sales_order_lines').update({
        qty_invoiced: (currentLine?.qty_invoiced || 0) + l.qty_delivered
      }).eq('id', l.order_line_id);
    }

    toast.success(`AR Invoice ${invNumber} created from delivery note`);
    fetchData();
  };

  const exportColumns = [
    { key: 'dn_number', header: 'DN #' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'order_number', header: 'Sales Order' },
    { key: 'delivery_date', header: 'Date' },
    { key: 'status', header: 'Status' },
  ];

  const exportData = deliveries.map(d => ({
    ...d,
    customer_name: d.customers?.name,
    order_number: d.sales_orders?.order_number,
  }));

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Delivery Notes" description="Track shipments and generate invoices from deliveries" actions={
          <ExportButtons data={exportData} filename="delivery-notes" title="Delivery Notes" columns={exportColumns} />
        } />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">DN #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sales Order</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deliveries.map((d: any) => (
                    <tr key={d.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => viewDetail(d)}>
                      <td className="px-4 py-3 text-sm font-medium">{d.dn_number}</td>
                      <td className="px-4 py-3 text-sm">{d.customers?.name}</td>
                      <td className="px-4 py-3 text-sm">{d.sales_orders?.order_number}</td>
                      <td className="px-4 py-3 text-sm">{d.locations?.name}</td>
                      <td className="px-4 py-3 text-sm">{d.delivery_date}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {d.status === 'posted' && (
                          <Button variant="outline" size="sm" onClick={() => handleGenerateInvoice(d)}>
                            <Receipt className="h-3 w-3 mr-1" /> Invoice
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {detail && (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{detail.dn_number}</h3>
                  <p className="text-sm text-muted-foreground">{detail.customers?.name} • {detail.delivery_date}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Close</Button>
              </div>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                    <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Qty Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detailLines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2 text-sm">{l.items?.name || l.sales_order_lines?.description || '—'}</td>
                      <td className="py-2 text-sm text-right">{l.qty_delivered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AttachmentPanel entityType="delivery_notes" entityId={detail.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

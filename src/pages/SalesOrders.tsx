import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Check, Truck, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { AttachmentPanel } from '@/components/attachments/AttachmentPanel';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

export default function SalesOrders() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [dnDialogOpen, setDnDialogOpen] = useState(false);
  const [dnLocationId, setDnLocationId] = useState('');
  const [dnLines, setDnLines] = useState<{ order_line_id: string; qty: string; item_name: string; max_qty: number }[]>([]);
  const [form, setForm] = useState({ customer_id: '', expected_date: '', notes: '' });
  const [lines, setLines] = useState<{ item_id: string; description: string; quantity: string; unit_price: string }[]>([]);

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const { data } = await supabase.from('sales_orders').select('*, customers(name)').order('created_at', { ascending: false });
      return data || [];
    },
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-active'],
    queryFn: async () => { const { data } = await supabase.from('customers').select('id, name, code').eq('is_active', true).order('name'); return data || []; },
  });
  const { data: items = [] } = useQuery({
    queryKey: ['items-active'],
    queryFn: async () => { const { data } = await supabase.from('items').select('id, name, code, unit_cost').eq('is_active', true).order('name'); return data || []; },
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-active'],
    queryFn: async () => { const { data } = await supabase.from('locations').select('id, name, code').eq('is_active', true).order('name'); return data || []; },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
  };

  const openEditDialog = async (order: any) => {
    setEditingOrder(order);
    setForm({ customer_id: order.customer_id, expected_date: order.expected_date || '', notes: order.notes || '' });
    const { data } = await supabase.from('sales_order_lines').select('*').eq('order_id', order.id).order('line_number');
    setLines((data || []).map((l: any) => ({ item_id: l.item_id || '', description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price) })));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setForm({ customer_id: '', expected_date: '', notes: '' });
    setLines([]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.customer_id) throw new Error('Select a customer');
      if (lines.length === 0) throw new Error('Add at least one line');
      const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

      if (editingOrder) {
        const { error } = await supabase.from('sales_orders').update({
          customer_id: form.customer_id, expected_date: form.expected_date || null, subtotal, total_amount: subtotal,
        }).eq('id', editingOrder.id);
        if (error) throw error;
        await supabase.from('sales_order_lines').delete().eq('order_id', editingOrder.id);
        await supabase.from('sales_order_lines').insert(lines.map((l, i) => ({
          order_id: editingOrder.id, line_number: i + 1, item_id: l.item_id || null,
          description: l.description, quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
        })));
        return 'Sales Order updated';
      } else {
        const soNumber = await getNextTransactionNumber(organizationId!, 'SO', 'SO');
        const { data: so, error } = await supabase.from('sales_orders').insert({
          order_number: soNumber, customer_id: form.customer_id, expected_date: form.expected_date || null,
          subtotal, total_amount: subtotal, created_by: user?.id, organization_id: organizationId,
        }).select().single();
        if (error) throw error;
        await supabase.from('sales_order_lines').insert(lines.map((l, i) => ({
          order_id: so.id, line_number: i + 1, item_id: l.item_id || null,
          description: l.description, quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
        })));
        return `Sales Order ${soNumber} created`;
      }
    },
    onSuccess: (msg) => { invalidate(); toast.success(msg); setDialogOpen(false); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_orders').update({ status: 'confirmed' as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Order confirmed'); },
    onError: (err: any) => toast.error(err.message),
  });

  const openDelivery = async (order: any) => {
    const { data: soLines } = await supabase.from('sales_order_lines').select('*, items(name)').eq('order_id', order.id);
    const deliverableLines = (soLines || []).filter((l: any) => l.qty_delivered < l.quantity);
    if (deliverableLines.length === 0) return toast.info('All lines fully delivered');
    setDetailOrder(order);
    setDnLines(deliverableLines.map((l: any) => ({
      order_line_id: l.id, qty: String(l.quantity - l.qty_delivered),
      item_name: l.items?.name || l.description, max_qty: l.quantity - l.qty_delivered,
    })));
    setDnDialogOpen(true);
  };

  const deliveryMutation = useMutation({
    mutationFn: async () => {
      if (!dnLocationId) throw new Error('Select a location');
      const dnNumber = await getNextTransactionNumber(organizationId!, 'DN', 'DN');
      const { data: dn, error } = await supabase.from('delivery_notes').insert({
        dn_number: dnNumber, order_id: detailOrder.id, customer_id: detailOrder.customer_id,
        location_id: dnLocationId, created_by: user?.id, organization_id: organizationId,
      }).select().single();
      if (error) throw error;
      const validLines = dnLines.filter(l => parseFloat(l.qty) > 0);
      await supabase.from('delivery_note_lines').insert(validLines.map(l => ({
        dn_id: dn.id, order_line_id: l.order_line_id, qty_delivered: parseFloat(l.qty), item_id: null,
      })));
      await supabase.from('delivery_notes').update({ status: 'posted' as any }).eq('id', dn.id);
      return dnNumber;
    },
    onSuccess: (dnNumber) => { invalidate(); toast.success(`Delivery Note ${dnNumber} created and posted`); setDnDialogOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const viewOrderDetail = async (order: any) => {
    const { data } = await supabase.from('sales_order_lines').select('*, items(name, code)').eq('order_id', order.id);
    setOrderLines(data || []); setDetailOrder(order);
  };

  const addLine = () => setLines([...lines, { item_id: '', description: '', quantity: '1', unit_price: '0' }]);

  const exportColumns = [
    { key: 'order_number', header: 'Order #' }, { key: 'customer_name', header: 'Customer' },
    { key: 'order_date', header: 'Date' }, { key: 'status', header: 'Status' }, { key: 'total_amount', header: 'Total' },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Sales Orders" description="Manage sales orders and deliveries" actions={
          <div className="flex gap-2">
            <ExportButtons data={orders.map(o => ({ ...o, customer_name: o.customers?.name }))} filename="sales-orders" title="Sales Orders" columns={exportColumns} />
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Order</Button>
          </div>
        } />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => viewOrderDetail(o)}>
                      <td className="px-4 py-3 text-sm font-medium">{o.order_number}</td>
                      <td className="px-4 py-3 text-sm">{o.customers?.name}</td>
                      <td className="px-4 py-3 text-sm">{o.order_date}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(o.total_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          {o.status === 'draft' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(o)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="outline" size="sm" onClick={() => confirmMutation.mutate(o.id)}><Check className="h-3 w-3 mr-1" /> Confirm</Button>
                            </>
                          )}
                          {['confirmed', 'partially_delivered'].includes(o.status) && (
                            <Button variant="outline" size="sm" onClick={() => openDelivery(o)}><Truck className="h-3 w-3 mr-1" /> Deliver</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {detailOrder && !dnDialogOpen && (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-lg font-semibold">{detailOrder.order_number}</h3><p className="text-sm text-muted-foreground">{detailOrder.customers?.name}</p></div>
                <Button variant="ghost" size="sm" onClick={() => setDetailOrder(null)}>Close</Button>
              </div>
              <table className="w-full mb-4">
                <thead><tr className="border-b">
                  <th className="py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                  <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Qty</th>
                  <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Price</th>
                  <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                  <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Delivered</th>
                  <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Invoiced</th>
                </tr></thead>
                <tbody className="divide-y">
                  {orderLines.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2 text-sm">{l.items?.name || l.description}</td>
                      <td className="py-2 text-sm text-right">{l.quantity}</td>
                      <td className="py-2 text-sm text-right">{formatCurrency(l.unit_price)}</td>
                      <td className="py-2 text-sm text-right">{formatCurrency(l.line_total)}</td>
                      <td className="py-2 text-sm text-right">{l.qty_delivered}</td>
                      <td className="py-2 text-sm text-right">{l.qty_invoiced}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AttachmentPanel entityType="sales_orders" entityId={detailOrder.id} />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingOrder ? 'Edit Sales Order' : 'New Sales Order'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Expected Date</Label><Input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>Lines</Label><Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button></div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-4">
                    <Select value={line.item_id} onValueChange={v => {
                      const item = items.find((it: any) => it.id === v);
                      const u = [...lines]; u[i] = { ...u[i], item_id: v, description: item?.name || '', unit_price: String(item?.unit_cost || 0) }; setLines(u);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.code} - {it.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3"><Input placeholder="Description" value={line.description} onChange={e => { const u = [...lines]; u[i].description = e.target.value; setLines(u); }} /></div>
                  <div className="col-span-2"><Input type="number" placeholder="Qty" value={line.quantity} onChange={e => { const u = [...lines]; u[i].quantity = e.target.value; setLines(u); }} /></div>
                  <div className="col-span-2"><Input type="number" placeholder="Price" value={line.unit_price} onChange={e => { const u = [...lines]; u[i].unit_price = e.target.value; setLines(u); }} /></div>
                  <div className="col-span-1 flex items-center"><Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</Button></div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editingOrder ? 'Update Order' : 'Create Order'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dnDialogOpen} onOpenChange={setDnDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Delivery Note</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Ship From Location</Label>
              <Select value={dnLocationId} onValueChange={setDnLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantities to Deliver</Label>
              {dnLines.map((l, i) => (
                <div key={l.order_line_id} className="flex items-center gap-3 py-2">
                  <span className="text-sm flex-1">{l.item_name}</span>
                  <Input type="number" className="w-24" max={l.max_qty} value={l.qty}
                    onChange={e => { const u = [...dnLines]; u[i].qty = e.target.value; setDnLines(u); }} />
                  <span className="text-xs text-muted-foreground">/ {l.max_qty}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDnDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => deliveryMutation.mutate()} disabled={deliveryMutation.isPending}>{deliveryMutation.isPending ? 'Posting...' : 'Post Delivery'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

export default function SalesQuotations() {
  const { user, organizationId } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', valid_until: '', notes: '' });
  const [lines, setLines] = useState<{ item_id: string; description: string; quantity: string; unit_price: string }[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [qRes, cRes, iRes] = await Promise.all([
      supabase.from('sales_quotations').select('*, customers(name)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name, code').eq('is_active', true).order('name'),
      supabase.from('items').select('id, name, code, unit_cost').eq('is_active', true).order('name'),
    ]);
    setQuotations(qRes.data || []);
    setCustomers(cRes.data || []);
    setItems(iRes.data || []);
    setLoading(false);
  };

  const generateNumber = () => `SQ-${Date.now().toString(36).toUpperCase()}`;

  const handleCreate = async () => {
    if (!form.customer_id) return toast.error('Select a customer');
    if (lines.length === 0) return toast.error('Add at least one line');

    const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
    const { data: q, error } = await supabase.from('sales_quotations').insert({
      quotation_number: generateNumber(),
      customer_id: form.customer_id,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
      subtotal,
      total_amount: subtotal,
      created_by: user?.id, organization_id: organizationId,
    }).select().single();

    if (error) return toast.error(error.message);

    const lineInserts = lines.map((l, i) => ({
      quotation_id: q.id,
      line_number: i + 1,
      item_id: l.item_id || null,
      description: l.description,
      quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0,
    }));
    await supabase.from('sales_quotation_lines').insert(lineInserts);

    toast.success('Quotation created');
    setDialogOpen(false);
    setForm({ customer_id: '', valid_until: '', notes: '' });
    setLines([]);
    fetchData();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('sales_quotations').update({ status: status as any }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`Quotation ${status}`);
    fetchData();
  };

  const handleConvertToSO = async (q: any) => {
    // Fetch quotation lines
    const { data: qLines } = await supabase.from('sales_quotation_lines').select('*').eq('quotation_id', q.id);
    if (!qLines || qLines.length === 0) return toast.error('No lines to convert');

    const soNumber = `SO-${Date.now().toString(36).toUpperCase()}`;
    const { data: so, error } = await supabase.from('sales_orders').insert({
      order_number: soNumber,
      customer_id: q.customer_id,
      quotation_id: q.id,
      subtotal: q.subtotal,
      tax_amount: q.tax_amount,
      total_amount: q.total_amount,
      created_by: user?.id, organization_id: organizationId,
    }).select().single();

    if (error) return toast.error(error.message);

    const soLines = qLines.map((l: any, i: number) => ({
      order_id: so.id,
      line_number: i + 1,
      item_id: l.item_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
    }));
    await supabase.from('sales_order_lines').insert(soLines);

    await supabase.from('sales_quotations').update({ status: 'accepted' as any }).eq('id', q.id);
    toast.success(`Sales Order ${soNumber} created from quotation`);
    fetchData();
  };

  const addLine = () => setLines([...lines, { item_id: '', description: '', quantity: '1', unit_price: '0' }]);

  const exportColumns = [
    { key: 'quotation_number', header: 'Quotation #' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'quotation_date', header: 'Date' },
    { key: 'status', header: 'Status' },
    { key: 'total_amount', header: 'Total' },
  ];

  const exportData = quotations.map(q => ({
    ...q,
    customer_name: q.customers?.name,
  }));

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Sales Quotations" description="Create and manage customer quotations" actions={
          <div className="flex gap-2">
            <ExportButtons data={exportData} filename="sales-quotations" title="Sales Quotations" columns={exportColumns} />
            <Button onClick={() => { setDialogOpen(true); setLines([]); }}>
              <Plus className="h-4 w-4 mr-1" /> New Quotation
            </Button>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Valid Until</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quotations.map((q: any) => (
                    <tr key={q.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{q.quotation_number}</td>
                      <td className="px-4 py-3 text-sm">{q.customers?.name}</td>
                      <td className="px-4 py-3 text-sm">{q.quotation_date}</td>
                      <td className="px-4 py-3 text-sm">{q.valid_until || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(q.total_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {q.status === 'draft' && (
                            <Button variant="outline" size="sm" onClick={() => handleStatusChange(q.id, 'sent')}>Send</Button>
                          )}
                          {q.status === 'sent' && (
                            <Button variant="outline" size="sm" onClick={() => handleConvertToSO(q)}>
                              <ArrowRight className="h-3 w-3 mr-1" /> Convert to SO
                            </Button>
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
      </div>

      {/* New Quotation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer</Label>
                <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lines</Label>
                <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                  <div className="col-span-4">
                    <Select value={line.item_id} onValueChange={v => {
                      const item = items.find((it: any) => it.id === v);
                      const updated = [...lines];
                      updated[i] = { ...updated[i], item_id: v, description: item?.name || '', unit_price: String(item?.unit_cost || 0) };
                      setLines(updated);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.code} - {it.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input placeholder="Description" value={line.description} onChange={e => { const u = [...lines]; u[i].description = e.target.value; setLines(u); }} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Qty" value={line.quantity} onChange={e => { const u = [...lines]; u[i].quantity = e.target.value; setLines(u); }} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" placeholder="Price" value={line.unit_price} onChange={e => { const u = [...lines]; u[i].unit_price = e.target.value; setLines(u); }} />
                  </div>
                  <div className="col-span-1 flex items-center">
                    <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Quotation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

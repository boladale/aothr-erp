import { useEffect, useState } from 'react';
import { Plus, Search, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { APInvoice, PurchaseOrder, Vendor, PurchaseOrderLine, Item } from '@/lib/supabase';

interface InvoiceWithDetails extends APInvoice {
  vendors: Vendor | null;
  purchase_orders: { po_number: string } | null;
}

interface POWithVendor extends PurchaseOrder {
  vendors: { id: string; name: string } | null;
}

interface POLineWithItem extends PurchaseOrderLine {
  items: Item | null;
}

interface InvoiceLine {
  po_line_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  max_invoiceable: number;
  item_name: string;
}

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [receivedPOs, setReceivedPOs] = useState<POWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [poLines, setPOLines] = useState<POLineWithItem[]>([]);
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
  });
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPO) {
      fetchPOLines(selectedPO);
    }
  }, [selectedPO]);

  const fetchData = async () => {
    try {
      const [invoicesRes, posRes] = await Promise.all([
        supabase.from('ap_invoices').select('*, vendors(*), purchase_orders(po_number)').order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('*, vendors(id, name)').in('status', ['partially_received', 'fully_received']).order('po_number'),
      ]);

      setInvoices((invoicesRes.data || []) as InvoiceWithDetails[]);
      setReceivedPOs((posRes.data || []) as POWithVendor[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPOLines = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_lines')
        .select('*, items(*)')
        .eq('po_id', poId)
        .order('line_number');

      if (error) throw error;

      const poLinesData = (data || []) as POLineWithItem[];
      setPOLines(poLinesData);

      setLines(poLinesData.map(pl => ({
        po_line_id: pl.id,
        item_id: pl.item_id,
        quantity: 0,
        unit_price: pl.unit_price,
        max_invoiceable: pl.qty_received - pl.qty_invoiced,
        item_name: pl.items?.name || '',
      })));
    } catch (error) {
      console.error('Error fetching PO lines:', error);
    }
  };

  const handleCreate = async () => {
    if (!selectedPO || !form.invoice_number) {
      toast.error('Please fill all required fields');
      return;
    }

    const validLines = lines.filter(l => l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Please enter at least one quantity');
      return;
    }

    // Validate no over-invoice
    const overInvoice = validLines.find(l => l.quantity > l.max_invoiceable);
    if (overInvoice) {
      toast.error(`Cannot invoice more than received for ${overInvoice.item_name}`);
      return;
    }

    const po = receivedPOs.find(p => p.id === selectedPO);
    if (!po?.vendors?.id) {
      toast.error('Could not determine vendor');
      return;
    }

    setSaving(true);
    try {
      const subtotal = validLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);

      const { data: invoice, error: invError } = await supabase
        .from('ap_invoices')
        .insert({
          invoice_number: form.invoice_number,
          vendor_id: po.vendors.id,
          po_id: selectedPO,
          invoice_date: form.invoice_date,
          due_date: form.due_date || null,
          subtotal,
          total_amount: subtotal,
          created_by: user?.id,
        })
        .select()
        .single();

      if (invError) throw invError;

      const lineInserts = validLines.map(l => ({
        invoice_id: invoice.id,
        po_line_id: l.po_line_id,
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }));

      const { error: linesError } = await supabase
        .from('ap_invoice_lines')
        .insert(lineInserts);

      if (linesError) throw linesError;

      toast.success('Invoice created. Post it to update PO status.');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        toast.error('Invoice number already exists for this vendor');
      } else {
        toast.error(err.message || 'Failed to create invoice');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (invoice: InvoiceWithDetails) => {
    try {
      // Get invoice lines
      const { data: invLines, error: linesError } = await supabase
        .from('ap_invoice_lines')
        .select('*, purchase_order_lines(*)')
        .eq('invoice_id', invoice.id);

      if (linesError) throw linesError;

      // Update PO line qty_invoiced
      for (const line of invLines || []) {
        const poLine = line.purchase_order_lines;
        if (poLine) {
          await supabase
            .from('purchase_order_lines')
            .update({ qty_invoiced: (poLine.qty_invoiced || 0) + line.quantity })
            .eq('id', line.po_line_id);
        }
      }

      // Update invoice status
      await supabase
        .from('ap_invoices')
        .update({ 
          status: 'posted',
          posted_at: new Date().toISOString(),
          posted_by: user?.id,
        })
        .eq('id', invoice.id);

      // Check closure readiness
      await checkClosureReadiness(invoice.po_id);

      toast.success('Invoice posted');
      fetchData();
    } catch (error) {
      console.error('Error posting invoice:', error);
      toast.error('Failed to post invoice');
    }
  };

  const checkClosureReadiness = async (poId: string) => {
    const { data: poLines } = await supabase
      .from('purchase_order_lines')
      .select('quantity, qty_received, qty_invoiced')
      .eq('po_id', poId);

    const ready = poLines?.every(l => 
      l.qty_received >= l.quantity && l.qty_invoiced >= l.quantity
    );

    if (ready) {
      await supabase
        .from('purchase_orders')
        .update({ close_ready: true })
        .eq('id', poId);

      const { data: po } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('id', poId)
        .single();

      if (user?.id && po) {
        await supabase
          .from('notifications')
          .upsert({
            user_id: user.id,
            entity_type: 'purchase_order',
            entity_id: poId,
            notification_type: 'po_ready_to_close',
            title: `PO ${po.po_number} is ready to be closed`,
            message: 'All items have been fully received and invoiced.',
          }, {
            onConflict: 'user_id,entity_type,entity_id,notification_type'
          });
      }
    }
  };

  const resetForm = () => {
    setSelectedPO('');
    setPOLines([]);
    setLines([]);
    setForm({ invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '' });
  };

  const updateLineQty = (idx: number, qty: number) => {
    const newLines = [...lines];
    newLines[idx].quantity = qty;
    setLines(newLines);
  };

  const filtered = invoices.filter(i =>
    i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    i.vendors?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', render: (i: InvoiceWithDetails) => <span className="font-medium">{i.invoice_number}</span> },
    { key: 'vendor', header: 'Vendor', render: (i: InvoiceWithDetails) => i.vendors?.name || '-' },
    { key: 'po', header: 'PO', render: (i: InvoiceWithDetails) => i.purchase_orders?.po_number || '-' },
    { key: 'invoice_date', header: 'Date', render: (i: InvoiceWithDetails) => new Date(i.invoice_date).toLocaleDateString() },
    { key: 'total_amount', header: 'Total', render: (i: InvoiceWithDetails) => `$${(i.total_amount || 0).toFixed(2)}` },
    { key: 'status', header: 'Status', render: (i: InvoiceWithDetails) => <StatusBadge status={i.status} /> },
    {
      key: 'actions',
      header: '',
      render: (i: InvoiceWithDetails) => (
        <div className="flex gap-2 justify-end">
          {i.status === 'draft' && (
            <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handlePost(i); }}>
              Post
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Invoices"
          description="Capture vendor invoices for PO matching"
          actions={
            <Button onClick={() => setDialogOpen(true)} disabled={receivedPOs.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
          }
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No invoices found."
        />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" /> New Invoice
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Order *</Label>
                  <Select value={selectedPO} onValueChange={setSelectedPO}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select PO" />
                    </SelectTrigger>
                    <SelectContent>
                      {receivedPOs.map(po => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number} - {po.vendors?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number *</Label>
                  <Input
                    value={form.invoice_number}
                    onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="INV-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={form.invoice_date}
                    onChange={e => setForm({ ...form, invoice_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>

              {lines.length > 0 && (
                <div className="space-y-2">
                  <Label>Items to Invoice</Label>
                  <div className="border rounded-lg divide-y">
                    {lines.map((line, idx) => (
                      <div key={line.po_line_id} className="p-3 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{line.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Max invoiceable: {line.max_invoiceable} @ ${line.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={line.max_invoiceable}
                          className="w-28"
                          value={line.quantity}
                          onChange={e => updateLineQty(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span className="w-24 text-right font-medium">
                          ${(line.quantity * line.unit_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2 border-t">
                    <span className="font-medium">
                      Total: ${lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

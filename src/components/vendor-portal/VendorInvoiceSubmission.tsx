import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface Props {
  vendorId: string;
  userId: string;
  invoices: any[];
  purchaseOrders: any[];
}

export function VendorInvoiceSubmission({ vendorId, userId, invoices, purchaseOrders }: Props) {
  const queryClient = useQueryClient();
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<{ po_line_id: string; item_id: string; quantity: number; unit_price: number }[]>([]);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // POs that can be invoiced (sent, received, approved)
  const invoiceablePOs = purchaseOrders.filter((po: any) => ['sent', 'approved', 'received'].includes(po.status));

  const loadPOLines = async (poId: string) => {
    setSelectedPOId(poId);
    const { data } = await supabase.from('purchase_order_lines')
      .select('*, items(item_code, description)')
      .eq('po_id', poId);
    
    setLineItems((data || []).map((line: any) => ({
      po_line_id: line.id,
      item_id: line.item_id,
      quantity: Math.max(0, line.quantity - (line.qty_invoiced || 0)),
      unit_price: line.unit_price,
      description: line.items?.description || line.description,
      max_qty: line.quantity - (line.qty_invoiced || 0),
    })));
  };

  const submitInvoice = useMutation({
    mutationFn: async () => {
      if (!selectedPOId || !invoiceNumber) throw new Error('PO and invoice number are required');
      
      const validLines = lineItems.filter((l: any) => l.quantity > 0);
      if (validLines.length === 0) throw new Error('At least one line item is required');

      const subtotal = validLines.reduce((s, l) => s + (l.quantity * l.unit_price), 0);
      
      const { data: invoice, error } = await supabase.from('ap_invoices').insert({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        vendor_id: vendorId,
        po_id: selectedPOId,
        subtotal,
        total_amount: subtotal,
        status: 'draft',
        payment_status: 'unpaid',
        created_by: userId,
      }).select().single();
      if (error) throw error;

      const invoiceLines = validLines.map((l) => ({
        invoice_id: invoice.id,
        po_line_id: l.po_line_id,
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.quantity * l.unit_price,
      }));
      const { error: lineError } = await supabase.from('ap_invoice_lines').insert(invoiceLines);
      if (lineError) throw lineError;
    },
    onSuccess: () => {
      toast.success('Invoice submitted successfully! It will be reviewed by the accounts team.');
      setCreateDialog(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to submit invoice'),
  });

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setCreateDialog(true); setSelectedPOId(''); setInvoiceNumber(''); setLineItems([]); }}>
          <Plus className="h-4 w-4 mr-1" /> Submit Invoice
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No invoices submitted</TableCell></TableRow>
            ) : invoices.map((inv: any) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                <TableCell>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{Number(inv.total_amount).toLocaleString()}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell><StatusBadge status={inv.payment_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Purchase Order</Label>
                <Select value={selectedPOId} onValueChange={loadPOLines}>
                  <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {invoiceablePOs.map((po: any) => (
                      <SelectItem key={po.id} value={po.id}>{po.po_number} — {Number(po.total_amount).toLocaleString()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {lineItems.length > 0 && (
              <div>
                <Label className="mb-2 block">Invoice Lines</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Available Qty</TableHead>
                      <TableHead>Invoice Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((line: any, idx: number) => (
                      <TableRow key={line.po_line_id}>
                        <TableCell>{line.description || 'Item'}</TableCell>
                        <TableCell>{line.max_qty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-24"
                            value={line.quantity}
                            onChange={(e) => {
                              const updated = [...lineItems];
                              updated[idx] = { ...updated[idx], quantity: Math.min(Number(e.target.value), line.max_qty) };
                              setLineItems(updated);
                            }}
                            min={0}
                            max={line.max_qty}
                          />
                        </TableCell>
                        <TableCell>{Number(line.unit_price).toLocaleString()}</TableCell>
                        <TableCell className="font-mono">{(line.quantity * line.unit_price).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-right font-semibold mt-2">
                  Total: {lineItems.reduce((s: number, l: any) => s + (l.quantity * l.unit_price), 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => submitInvoice.mutate()} disabled={submitInvoice.isPending || !selectedPOId || !invoiceNumber}>
              Submit Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Lets AP/finance staff log an invoice on behalf of a vendor (e.g. emailed PDF, hand-delivered)
 * without requiring the vendor to use the Vendor Portal. Drops the invoice into the AP Inbox
 * with status 'pending_approval' so the usual review/approve/post flow applies.
 */
export function LogVendorInvoiceDialog({ open, onOpenChange, onCreated }: Props) {
  const { user, organizationId } = useAuth();
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);

  const reset = () => {
    setVendorId(''); setPoId(''); setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(''); setLines([]); setInvoiceFile(null); setCertFile(null);
  };

  const vendorsQ = useQuery({
    queryKey: ['vendors-active-list'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name, status').eq('status', 'active' as any).order('name');
      return data || [];
    },
    enabled: open,
  });

  const posQ = useQuery({
    queryKey: ['vendor-pos-invoiceable', vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data } = await supabase.from('purchase_orders')
        .select('id, po_number, total_amount, status')
        .eq('vendor_id', vendorId)
        .in('status', ['sent', 'approved', 'fully_received', 'partially_received'])
        .order('po_number');
      return data || [];
    },
    enabled: !!vendorId,
  });

  const loadPOLines = async (id: string) => {
    setPoId(id);
    const { data } = await supabase.from('purchase_order_lines')
      .select('*, items(item_code, description)')
      .eq('po_id', id);
    setLines((data || []).map((l: any) => {
      const remaining = Math.max(0, Number(l.quantity) - Number(l.qty_invoiced || 0));
      return {
        po_line_id: l.id,
        item_id: l.item_id,
        quantity: remaining > 0 ? remaining : Number(l.quantity),
        unit_price: Number(l.unit_price),
        description: l.items?.description || l.description,
      };
    }));
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!vendorId || !poId || !invoiceNumber.trim()) throw new Error('Vendor, PO and invoice number are required');
      const valid = lines.filter((l) => Number(l.quantity) > 0);
      if (valid.length === 0) throw new Error('At least one line is required');
      const subtotal = valid.reduce((s, l) => s + l.quantity * l.unit_price, 0);

      const { data: invoice, error } = await (supabase.from('ap_invoices') as any).insert({
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        vendor_id: vendorId,
        po_id: poId,
        subtotal,
        total_amount: subtotal,
        status: 'pending_approval',
        payment_status: 'unpaid',
        source: 'vendor',
        organization_id: organizationId,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;

      const insertLines = valid.map((l) => ({
        invoice_id: invoice.id,
        po_line_id: l.po_line_id,
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.quantity * l.unit_price,
      }));
      const { error: le } = await supabase.from('ap_invoice_lines').insert(insertLines);
      if (le) throw le;

      const uploads: { file: File; label: string }[] = [];
      if (invoiceFile) uploads.push({ file: invoiceFile, label: 'Invoice' });
      if (certFile) uploads.push({ file: certFile, label: 'Supporting Document' });
      for (const u of uploads) {
        const path = `ap_invoice/${invoice.id}/${Date.now()}-${u.label.replace(/\s+/g, '_')}-${u.file.name}`;
        const { error: ue } = await supabase.storage.from('transaction-attachments').upload(path, u.file);
        if (ue) throw ue;
        const { data: urlData } = supabase.storage.from('transaction-attachments').getPublicUrl(path);
        await supabase.from('transaction_attachments').insert({
          entity_type: 'ap_invoice',
          entity_id: invoice.id,
          file_name: `${u.label} - ${u.file.name}`,
          file_url: urlData.publicUrl,
          file_size: u.file.size,
          content_type: u.file.type,
          uploaded_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      toast.success('Vendor invoice logged — sent to AP inbox for review');
      qc.invalidateQueries({ queryKey: ['ap_invoices', 'inbox'] });
      reset();
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to log invoice'),
  });

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Vendor Invoice (on behalf of vendor)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={(v) => { setVendorId(v); setPoId(''); setLines([]); }}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {(vendorsQ.data || []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purchase Order *</Label>
              <Select value={poId} onValueChange={loadPOLines} disabled={!vendorId}>
                <SelectTrigger><SelectValue placeholder={vendorId ? 'Select PO' : 'Pick a vendor first'} /></SelectTrigger>
                <SelectContent>
                  {(posQ.data || []).map((po: any) => (
                    <SelectItem key={po.id} value={po.id}>{po.po_number} — {formatCurrency(po.total_amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Number *</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Vendor's invoice #" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          {lines.length > 0 && (
            <div>
              <Label className="mb-2 block">Lines (editable quantities)</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Unit Price</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={l.po_line_id}>
                      <TableCell>{l.description || 'Item'}</TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={l.quantity}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setLines(lines.map((x, ix) => ix === i ? { ...x, quantity: v } : x));
                          }} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={l.unit_price}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setLines(lines.map((x, ix) => ix === i ? { ...x, unit_price: v } : x));
                          }} />
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(l.quantity * l.unit_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right font-semibold mt-2">Total: {formatCurrency(total)}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <Label>Invoice Document</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
              {invoiceFile && <p className="text-xs">Selected: <span className="font-medium">{invoiceFile.name}</span></p>}
            </div>
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <Label>Supporting Document</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
              {certFile && <p className="text-xs">Selected: <span className="font-medium">{certFile.name}</span></p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || !vendorId || !poId || !invoiceNumber.trim() || lines.length === 0}>
            {submit.isPending ? 'Logging...' : 'Log Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

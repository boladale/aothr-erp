import { useEffect, useState } from 'react';
import { Plus, Search, Receipt, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { APInvoice, PurchaseOrder, Vendor, PurchaseOrderLine, Item } from '@/lib/supabase';

interface InvoiceWithDetails extends APInvoice { vendors: Vendor | null; purchase_orders: { po_number: string } | null; }
interface POWithVendor extends PurchaseOrder { vendors: { id: string; name: string } | null; }
interface POLineWithItem extends PurchaseOrderLine { items: Item | null; }
interface GLAccount { id: string; account_code: string; account_name: string; account_type: string; }
interface InvoiceLine { po_line_id: string; item_id: string; quantity: number; unit_price: number; max_invoiceable: number; item_name: string; expense_account_id: string; }

export default function Invoices() {
  const { user, hasRole, organizationId } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole('accounts_payable') || hasRole('admin');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [poLines, setPOLines] = useState<POLineWithItem[]>([]);
  const [form, setForm] = useState({ invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '' });
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  const invoicesQ = useQuery({
    queryKey: ['ap_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ap_invoices').select('*, vendors(*), purchase_orders(po_number)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InvoiceWithDetails[];
    },
  });
  const receivedPOsQ = useQuery({
    queryKey: ['purchase_orders', 'received-for-invoice'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*, vendors(id, name)').in('status', ['partially_received', 'fully_received']).order('po_number');
      if (error) throw error;
      return (data || []) as POWithVendor[];
    },
  });
  const glAccountsQ = useQuery({
    queryKey: ['gl_accounts', 'leaf-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name, account_type').eq('is_header', false).eq('is_active', true).order('account_code');
      if (error) throw error;
      return (data || []) as GLAccount[];
    },
  });

  const invoices = invoicesQ.data || [];
  const receivedPOs = receivedPOsQ.data || [];
  const glAccounts = glAccountsQ.data || [];
  const loading = invoicesQ.isLoading;

  useEffect(() => { if (selectedPO && !editingInvoice) fetchPOLines(selectedPO); }, [selectedPO, editingInvoice]);

  const invalidateInvoices = () => qc.invalidateQueries({ queryKey: ['ap_invoices'] });

  const fetchPOLines = async (poId: string) => {
    const { data } = await supabase.from('purchase_order_lines').select('*, items(*)').eq('po_id', poId).order('line_number');
    const poLinesData = (data || []) as POLineWithItem[];
    setPOLines(poLinesData);
    setLines(poLinesData.map(pl => ({
      po_line_id: pl.id, item_id: pl.item_id, quantity: 0, unit_price: pl.unit_price,
      max_invoiceable: pl.qty_received - pl.qty_invoiced, item_name: pl.items?.name || '', expense_account_id: '',
    })));
  };

  const openEditDialog = async (invoice: InvoiceWithDetails) => {
    setEditingInvoice(invoice);
    setSelectedPO(invoice.po_id);
    setForm({ invoice_number: invoice.invoice_number, invoice_date: invoice.invoice_date, due_date: invoice.due_date || '' });
    // Load existing lines
    const { data: invLines } = await supabase.from('ap_invoice_lines').select('*, items(name)').eq('invoice_id', invoice.id);
    const { data: poLinesData } = await supabase.from('purchase_order_lines').select('*, items(*)').eq('po_id', invoice.po_id).order('line_number');
    const polMap = new Map((poLinesData || []).map((pl: any) => [pl.id, pl]));
    setLines((invLines || []).map((il: any) => {
      const pol = polMap.get(il.po_line_id) as any;
      return {
        po_line_id: il.po_line_id, item_id: il.item_id, quantity: il.quantity, unit_price: il.unit_price,
        max_invoiceable: pol ? pol.qty_received - pol.qty_invoiced + il.quantity : il.quantity,
        item_name: il.items?.name || pol?.items?.name || '', expense_account_id: il.expense_account_id || '',
      };
    }));
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPO || !form.invoice_number) throw new Error('Please fill all required fields');
      const validLines = lines.filter(l => l.quantity > 0);
      if (validLines.length === 0) throw new Error('Please enter at least one quantity');
      const overInvoice = validLines.find(l => l.quantity > l.max_invoiceable);
      if (overInvoice) throw new Error(`Cannot invoice more than received for ${overInvoice.item_name}`);

      const subtotal = validLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);

      if (editingInvoice) {
        const { error } = await supabase.from('ap_invoices').update({
          invoice_number: form.invoice_number, invoice_date: form.invoice_date, due_date: form.due_date || null,
          subtotal, total_amount: subtotal,
        }).eq('id', editingInvoice.id);
        if (error) throw error;
        await supabase.from('ap_invoice_lines').delete().eq('invoice_id', editingInvoice.id);
        await supabase.from('ap_invoice_lines').insert(validLines.map(l => ({
          invoice_id: editingInvoice.id, po_line_id: l.po_line_id, item_id: l.item_id,
          quantity: l.quantity, unit_price: l.unit_price, expense_account_id: l.expense_account_id || null,
        })));
        return 'updated';
      }
      const po = receivedPOs.find(p => p.id === selectedPO);
      if (!po?.vendors?.id) throw new Error('Could not determine vendor');
      const { data: invoice, error } = await supabase.from('ap_invoices').insert({
        invoice_number: form.invoice_number, vendor_id: po.vendors.id, po_id: selectedPO,
        invoice_date: form.invoice_date, due_date: form.due_date || null,
        subtotal, total_amount: subtotal, created_by: user?.id, organization_id: organizationId,
      }).select().single();
      if (error) throw error;
      await supabase.from('ap_invoice_lines').insert(validLines.map(l => ({
        invoice_id: invoice.id, po_line_id: l.po_line_id, item_id: l.item_id,
        quantity: l.quantity, unit_price: l.unit_price, expense_account_id: l.expense_account_id || null,
      })));
      return 'created';
    },
    onSuccess: (res) => {
      toast.success(res === 'updated' ? 'Invoice updated' : 'Invoice created');
      setDialogOpen(false);
      resetForm();
      invalidateInvoices();
    },
    onError: (error: any) => {
      const code = error?.code;
      toast.error(code === '23505' ? 'Invoice number already exists' : error?.message || 'Failed to save');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (invoice: InvoiceWithDetails) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'pending_approval', rejection_reason: null }).eq('id', invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice submitted for approval'); invalidateInvoices(); },
    onError: () => toast.error('Failed to submit'),
  });
  const approveMutation = useMutation({
    mutationFn: async (invoice: InvoiceWithDetails) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'approved' }).eq('id', invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice approved'); invalidateInvoices(); },
    onError: () => toast.error('Failed to approve'),
  });
  const rejectMutation = useMutation({
    mutationFn: async ({ invoice, reason }: { invoice: InvoiceWithDetails; reason: string }) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'draft', rejection_reason: reason }).eq('id', invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice returned to draft'); invalidateInvoices(); },
    onError: () => toast.error('Failed to reject'),
  });
  const handleRejectInvoice = (invoice: InvoiceWithDetails) => {
    const reason = window.prompt('Please enter a reason for rejection:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('A rejection reason is required'); return; }
    rejectMutation.mutate({ invoice, reason });
  };
  const postMutation = useMutation({
    mutationFn: async (invoice: InvoiceWithDetails) => {
      const { data, error } = await supabase.functions.invoke('secure-action', {
        body: { action: 'invoice_post', payload: { id: invoice.id } },
      });
      const errMsg = error?.message || (data as any)?.error;
      if (errMsg) {
        if (errMsg.includes('unresolved hold')) throw new Error('Invoice has unresolved exceptions');
        throw new Error(errMsg);
      }
      const { data: updated } = await supabase.from('ap_invoices').select('status').eq('id', invoice.id).single();
      if (updated?.status === 'draft') throw new Error('Invoice failed three-way matching');
    },
    onSuccess: () => { toast.success('Invoice posted'); invalidateInvoices(); },
    onError: (e: any) => { toast.error(e?.message || 'Failed to post'); invalidateInvoices(); },
  });

  const resetForm = () => {
    setEditingInvoice(null); setSelectedPO(''); setPOLines([]); setLines([]);
    setForm({ invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '' });
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
    { key: 'total_amount', header: 'Total', render: (i: InvoiceWithDetails) => `₦${(i.total_amount || 0).toFixed(2)}` },
    { key: 'status', header: 'Status', render: (i: InvoiceWithDetails) => (
      <div>
        <StatusBadge status={i.status} />
        {i.status === 'draft' && i.rejection_reason && (
          <p className="text-xs text-destructive mt-1" title={i.rejection_reason}>⚠ {i.rejection_reason.length > 40 ? i.rejection_reason.slice(0, 40) + '…' : i.rejection_reason}</p>
        )}
      </div>
    )},
    {
      key: 'actions', header: '',
      render: (i: InvoiceWithDetails) => (
        <div className="flex gap-2 justify-end">
          {i.status === 'draft' && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditDialog(i); }}><Pencil className="h-3 w-3" /></Button>
          )}
          {i.status === 'draft' && i.created_by === user?.id && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSubmitInvoice(i); }}>Submit</Button>
          )}
          {i.status === 'pending_approval' && canApprove && (
            <>
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleApproveInvoice(i); }}>Approve</Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRejectInvoice(i); }}>Reject</Button>
            </>
          )}
          {i.status === 'approved' && canApprove && (
            <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handlePost(i); }}>Post</Button>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Invoices" description="Capture vendor invoices for PO matching"
          actions={<Button onClick={() => { resetForm(); setDialogOpen(true); }} disabled={receivedPOs.length === 0}><Plus className="mr-2 h-4 w-4" /> Create Invoice</Button>} />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No invoices found." />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {editingInvoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Order *</Label>
                  {editingInvoice ? (
                    <Input value={editingInvoice.purchase_orders?.po_number || ''} disabled />
                  ) : (
                    <Select value={selectedPO} onValueChange={setSelectedPO}>
                      <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                      <SelectContent>{receivedPOs.map(po => <SelectItem key={po.id} value={po.id}>{po.po_number} - {po.vendors?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2"><Label>Invoice Number *</Label><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-001" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              {lines.length > 0 && (
                <div className="space-y-2">
                  <Label>Items to Invoice</Label>
                  <div className="border rounded-lg divide-y">
                    {lines.map((line, idx) => (
                      <div key={line.po_line_id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{line.item_name}</p>
                            <p className="text-xs text-muted-foreground">Max invoiceable: {line.max_invoiceable} @ ₦{line.unit_price.toFixed(2)}</p>
                          </div>
                          <Input type="number" min="0" max={line.max_invoiceable} className="w-28" value={line.quantity}
                            onChange={e => { const newLines = [...lines]; newLines[idx].quantity = parseFloat(e.target.value) || 0; setLines(newLines); }} placeholder="0" />
                          <span className="w-24 text-right font-medium">₦{(line.quantity * line.unit_price).toFixed(2)}</span>
                        </div>
                        <Select value={line.expense_account_id} onValueChange={(val) => { const newLines = [...lines]; newLines[idx].expense_account_id = val; setLines(newLines); }}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Select GL Account (defaults to COGS)" /></SelectTrigger>
                          <SelectContent>{glAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2 border-t">
                    <span className="font-medium">Total: ₦{lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

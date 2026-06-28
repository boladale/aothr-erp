import { useState } from 'react';
import { Search, Inbox, CheckCircle2, XCircle, ArrowRight, Plus } from 'lucide-react';
import { LogVendorInvoiceDialog } from '@/components/invoices/LogVendorInvoiceDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AttachmentPanel } from '@/components/attachments/AttachmentPanel';
import { formatCurrency } from '@/lib/utils';

interface VendorInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  status: string;
  payment_status: string;
  rejection_reason: string | null;
  po_id: string | null;
  vendors: { name: string } | null;
  purchase_orders: { po_number: string; total_amount: number } | null;
  created_at: string;
}

function ThreeWayMatchPanel({ invoice }: { invoice: VendorInvoice }) {
  const matchQ = useQuery({
    queryKey: ['three-way-match', invoice.id],
    queryFn: async () => {
      if (!invoice.po_id) return null;
      const [{ data: poLines }, { data: grns }, { data: invLines }] = await Promise.all([
        supabase.from('purchase_order_lines').select('quantity, unit_price, line_total').eq('po_id', invoice.po_id),
        supabase.from('goods_receipts').select('id, status, goods_receipt_lines(qty_received, unit_cost)').eq('po_id', invoice.po_id),
        supabase.from('ap_invoice_lines').select('quantity, unit_price, line_total').eq('invoice_id', invoice.id),
      ]);
      const poQty = (poLines || []).reduce((s: number, l: any) => s + Number(l.quantity || 0), 0);
      const poAmt = (poLines || []).reduce((s: number, l: any) => s + Number(l.line_total || 0), 0);
      const grnQty = (grns || []).filter((g: any) => g.status === 'posted')
        .reduce((s: number, g: any) => s + (g.goods_receipt_lines || []).reduce((x: number, l: any) => x + Number(l.qty_received || 0), 0), 0);
      const invQty = (invLines || []).reduce((s: number, l: any) => s + Number(l.quantity || 0), 0);
      const invAmt = (invLines || []).reduce((s: number, l: any) => s + Number(l.line_total || 0), 0) || Number(invoice.total_amount || 0);
      const tol = 0.01;
      const poOk = poQty > 0;
      const grnOk = poOk && Math.abs(grnQty - invQty) <= Math.max(tol, poQty * 0.001);
      const invOk = poOk && Math.abs(invAmt - poAmt) <= Math.max(0.5, poAmt * 0.001);
      return { poOk, grnOk, invOk, poQty, poAmt, grnQty, invQty, invAmt };
    },
  });
  if (!invoice.po_id) {
    return <div className="text-xs text-muted-foreground border rounded p-3">No PO linked — three-way match not applicable.</div>;
  }
  if (matchQ.isLoading || !matchQ.data) {
    return <div className="text-xs text-muted-foreground border rounded p-3">Checking three-way match…</div>;
  }
  const { poOk, grnOk, invOk, poQty, poAmt, grnQty, invQty, invAmt } = matchQ.data;
  const allOk = poOk && grnOk && invOk;
  const Row = ({ label, ok, detail }: { label: string; ok: boolean; detail: string }) => (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
        <span className="font-medium">{label}</span>
        <span className={ok ? 'text-success' : 'text-destructive'}>{ok ? '✓' : '✗'}</span>
      </div>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
  return (
    <div className={`border rounded p-3 ${allOk ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">Three-Way Match</span>
        <span className={`text-xs font-medium ${allOk ? 'text-success' : 'text-warning'}`}>
          {allOk ? 'Invoice matched' : 'Discrepancy detected'}
        </span>
      </div>
      <Row label="PO" ok={poOk} detail={`Qty ${poQty} · ${formatCurrency(poAmt)}`} />
      <Row label="GRN" ok={grnOk} detail={`Received ${grnQty} vs invoiced ${invQty}`} />
      <Row label="Invoice" ok={invOk} detail={`${formatCurrency(invAmt)} vs PO ${formatCurrency(poAmt)}`} />
    </div>
  );
}

export default function InvoiceInbox() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole('accounts_payable') || hasRole('admin');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VendorInvoice | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const invoicesQ = useQuery({
    queryKey: ['ap_invoices', 'inbox'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ap_invoices' as any) as any)
        .select('*, vendors(name), purchase_orders(po_number, total_amount)')
        .eq('source', 'vendor')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VendorInvoice[];
    },
  });
  const rows = invoicesQ.data || [];
  const loading = invoicesQ.isLoading;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ap_invoices', 'inbox'] });

  const approveMutation = useMutation({
    mutationFn: async (inv: VendorInvoice) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'approved' }).eq('id', inv.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice approved — ready to post'); setSelected(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message),
  });
  const rejectMutation = useMutation({
    mutationFn: async ({ inv, reason }: { inv: VendorInvoice; reason: string }) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'draft', rejection_reason: reason }).eq('id', inv.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice returned to vendor'); setSelected(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message),
  });
  const postMutation = useMutation({
    mutationFn: async (inv: VendorInvoice) => {
      const { error } = await supabase.from('ap_invoices').update({ status: 'posted', posted_at: new Date().toISOString(), posted_by: user?.id }).eq('id', inv.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Invoice posted to GL'); setSelected(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message),
  });

  const approve = (inv: VendorInvoice) => approveMutation.mutate(inv);
  const reject = (inv: VendorInvoice) => {
    const reason = window.prompt('Reason for rejection (sent back to vendor):');
    if (!reason || !reason.trim()) { toast.error('Rejection reason required'); return; }
    rejectMutation.mutate({ inv, reason });
  };
  const post = (inv: VendorInvoice) => postMutation.mutate(inv);

  const filtered = rows.filter(r =>
    r.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    r.vendors?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchase_orders?.po_number?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', render: (i: VendorInvoice) => <span className="font-medium">{i.invoice_number}</span> },
    { key: 'vendor', header: 'Vendor', render: (i: VendorInvoice) => i.vendors?.name || '-' },
    { key: 'po', header: 'PO', render: (i: VendorInvoice) => i.purchase_orders?.po_number || '-' },
    { key: 'invoice_date', header: 'Date', render: (i: VendorInvoice) => new Date(i.invoice_date).toLocaleDateString() },
    { key: 'received', header: 'Received', render: (i: VendorInvoice) => new Date(i.created_at).toLocaleDateString() },
    { key: 'total_amount', header: 'Amount', render: (i: VendorInvoice) => `₦${(i.total_amount || 0).toLocaleString()}` },
    { key: 'status', header: 'Status', render: (i: VendorInvoice) => <StatusBadge status={i.status} /> },
    {
      key: 'actions', header: '',
      render: (i: VendorInvoice) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(i); }}>
          Review <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )
    },
  ];

  const pending = rows.filter(r => r.status === 'pending_approval').length;

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="AP Invoice Inbox"
          description={`Invoices submitted by vendors (portal or logged by AP) — ${pending} awaiting review`}
          actions={
            <Button onClick={() => setLogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log Vendor Invoice
            </Button>
          }
        />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice, vendor, PO..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <LogVendorInvoiceDialog open={logOpen} onOpenChange={setLogOpen} onCreated={invalidate} />
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No vendor-submitted invoices yet." />

        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" /> Review Vendor Invoice {selected?.invoice_number}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{selected.vendors?.name}</span></div>
                  <div><span className="text-muted-foreground">PO:</span> <span className="font-medium">{selected.purchase_orders?.po_number}</span></div>
                  <div><span className="text-muted-foreground">Invoice Date:</span> {new Date(selected.invoice_date).toLocaleDateString()}</div>
                  <div><span className="text-muted-foreground">Due Date:</span> {selected.due_date ? new Date(selected.due_date).toLocaleDateString() : '-'}</div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{formatCurrency(selected.total_amount)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></div>
                </div>
                <AttachmentPanel entityType="ap_invoice" entityId={selected.id} />
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              {selected && canApprove && selected.status === 'pending_approval' && (
                <>
                  <Button variant="outline" onClick={() => reject(selected)}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button onClick={() => approve(selected)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </>
              )}
              {selected && canApprove && selected.status === 'approved' && (
                <Button onClick={() => post(selected)}>Post to GL</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

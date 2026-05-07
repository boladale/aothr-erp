import { useEffect, useState } from 'react';
import { Search, Inbox, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
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

interface VendorInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  status: string;
  payment_status: string;
  rejection_reason: string | null;
  vendors: { name: string } | null;
  purchase_orders: { po_number: string } | null;
  created_at: string;
}

export default function InvoiceInbox() {
  const { user, hasRole } = useAuth();
  const canApprove = hasRole('accounts_payable') || hasRole('admin');
  const [rows, setRows] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VendorInvoice | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from('ap_invoices' as any) as any)
      .select('*, vendors(name), purchase_orders(po_number)')
      .eq('source', 'vendor')
      .order('created_at', { ascending: false });
    setRows((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const approve = async (inv: VendorInvoice) => {
    const { error } = await supabase.from('ap_invoices').update({ status: 'approved' }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invoice approved — ready to post');
    setSelected(null);
    fetchData();
  };

  const reject = async (inv: VendorInvoice) => {
    const reason = window.prompt('Reason for rejection (sent back to vendor):');
    if (!reason || !reason.trim()) { toast.error('Rejection reason required'); return; }
    const { error } = await supabase.from('ap_invoices').update({ status: 'draft', rejection_reason: reason }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invoice returned to vendor');
    setSelected(null);
    fetchData();
  };

  const post = async (inv: VendorInvoice) => {
    const { error } = await supabase.from('ap_invoices').update({ status: 'posted', posted_at: new Date().toISOString(), posted_by: user?.id }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Invoice posted to GL');
    setSelected(null);
    fetchData();
  };

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
          description={`Invoices submitted by vendors via the Vendor Portal — ${pending} awaiting review`}
        />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice, vendor, PO..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
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
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">₦{Number(selected.total_amount).toLocaleString()}</span></div>
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

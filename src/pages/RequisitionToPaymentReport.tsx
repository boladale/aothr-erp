import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface LifecycleRow {
  req_number: string;
  req_date: string;
  approval_date: string;
  po_number: string;
  po_date: string;
  grn_number: string;
  grn_date: string;
  invoice_number: string;
  invoice_date: string;
  payment_date: string;
  vendor_name: string;
  total_amount: number;
}

export default function RequisitionToPaymentReport() {
  const [rows, setRows] = useState<LifecycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Get requisitions with approval dates
      const { data: reqs } = await supabase
        .from('requisitions')
        .select('id, req_number, created_at, approved_at')
        .order('created_at', { ascending: false });

      // Get PO trace links
      const { data: traceLinks } = await supabase
        .from('po_line_requisition_lines')
        .select('requisition_line_id, po_line_id, purchase_order_lines(po_id, purchase_orders(po_number, order_date, vendor_id, total_amount, vendors(name)))');

      // Get requisition lines to map req_id
      const { data: reqLines } = await supabase
        .from('requisition_lines')
        .select('id, requisition_id');

      // Get GRNs
      const { data: grnLines } = await supabase
        .from('goods_receipt_lines')
        .select('po_line_id, goods_receipts(grn_number, receipt_date, status)');

      // Get invoices
      const { data: invoices } = await supabase
        .from('ap_invoices')
        .select('po_id, invoice_number, invoice_date, status');

      // Get payments
      const { data: payments } = await supabase
        .from('ap_payments')
        .select('payment_date, status, ap_payment_allocations(invoice_id)')
        .eq('status', 'posted');

      const reqLineToReqMap = new Map<string, string>();
      (reqLines || []).forEach((rl: any) => { reqLineToReqMap.set(rl.id, rl.requisition_id); });

      // Map req_id -> PO info
      const reqToPO = new Map<string, any>();
      (traceLinks || []).forEach((t: any) => {
        const reqId = reqLineToReqMap.get(t.requisition_line_id);
        if (reqId && t.purchase_order_lines?.purchase_orders) {
          reqToPO.set(reqId, t.purchase_order_lines.purchase_orders);
        }
      });

      // Map po_line_id -> GRN
      const poLineToGRN = new Map<string, any>();
      (grnLines || []).forEach((g: any) => {
        if (g.goods_receipts?.status === 'posted') poLineToGRN.set(g.po_line_id, g.goods_receipts);
      });

      // Map po_id -> invoice
      const poToInvoice = new Map<string, any>();
      (invoices || []).forEach((inv: any) => { poToInvoice.set(inv.po_id, inv); });

      // Map invoice_id -> payment
      const invoiceToPayment = new Map<string, string>();
      (payments || []).forEach((p: any) => {
        (p.ap_payment_allocations || []).forEach((a: any) => {
          invoiceToPayment.set(a.invoice_id, p.payment_date);
        });
      });

      // Map po_id -> po_line_id (first)
      const poToPOLine = new Map<string, string>();
      (traceLinks || []).forEach((t: any) => {
        if (t.purchase_order_lines) {
          poToPOLine.set(t.purchase_order_lines.po_id, t.po_line_id);
        }
      });

      const result: LifecycleRow[] = [];
      (reqs || []).forEach((req: any) => {
        const po = reqToPO.get(req.id);
        if (!po) {
          result.push({
            req_number: req.req_number, req_date: req.created_at, approval_date: req.approved_at || '-',
            po_number: '-', po_date: '-', grn_number: '-', grn_date: '-',
            invoice_number: '-', invoice_date: '-', payment_date: '-', vendor_name: '-', total_amount: 0,
          });
          return;
        }

        const poLineId = poToPOLine.get(po.id);
        const grn = poLineId ? poLineToGRN.get(poLineId) : null;
        const inv = poToInvoice.get(po.id);
        const payDate = inv ? invoiceToPayment.get(inv.id) : null;

        result.push({
          req_number: req.req_number,
          req_date: req.created_at,
          approval_date: req.approved_at || '-',
          po_number: po.po_number,
          po_date: po.order_date,
          grn_number: grn?.grn_number || '-',
          grn_date: grn?.receipt_date || '-',
          invoice_number: inv?.invoice_number || '-',
          invoice_date: inv?.invoice_date || '-',
          payment_date: payDate || '-',
          vendor_name: po.vendors?.name || '-',
          total_amount: po.total_amount || 0,
        });
      });

      setRows(result);
    } catch { } finally { setLoading(false); }
  };

  const fmt = (d: string) => d && d !== '-' ? new Date(d).toLocaleDateString() : '-';

  const filtered = rows.filter(r =>
    r.req_number.toLowerCase().includes(search.toLowerCase()) ||
    r.po_number.toLowerCase().includes(search.toLowerCase()) ||
    r.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'req_number', header: 'PRN No' },
    { key: 'req_date', header: 'PRN Date', render: (r: LifecycleRow) => fmt(r.req_date) },
    { key: 'approval_date', header: 'Approved', render: (r: LifecycleRow) => fmt(r.approval_date) },
    { key: 'po_number', header: 'PO No' },
    { key: 'po_date', header: 'PO Date', render: (r: LifecycleRow) => fmt(r.po_date) },
    { key: 'grn_number', header: 'GRN No' },
    { key: 'grn_date', header: 'GRN Date', render: (r: LifecycleRow) => fmt(r.grn_date) },
    { key: 'invoice_number', header: 'Invoice No' },
    { key: 'invoice_date', header: 'Invoice Date', render: (r: LifecycleRow) => fmt(r.invoice_date) },
    { key: 'payment_date', header: 'Payment Date', render: (r: LifecycleRow) => fmt(r.payment_date) },
    { key: 'vendor_name', header: 'Vendor' },
    { key: 'total_amount', header: 'Amount', render: (r: LifecycleRow) => `₦${r.total_amount.toFixed(2)}` },
  ];

  const exportCols = columns.map(c => ({ key: c.key, header: c.header }));

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Requisition to Payment Report" description="End-to-end procurement lifecycle with dates"
          actions={<ExportButtons data={filtered.map(r => ({ ...r, req_date: fmt(r.req_date), approval_date: fmt(r.approval_date), po_date: fmt(r.po_date), grn_date: fmt(r.grn_date), invoice_date: fmt(r.invoice_date), payment_date: fmt(r.payment_date), total_amount: r.total_amount.toFixed(2) }))} filename="req-to-payment" title="Requisition to Payment Report" columns={exportCols} />} />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No data found." />
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface PaymentRow {
  req_number: string;
  po_number: string;
  grn_number: string;
  item_name: string;
  item_code: string;
  quantity: number;
  amount: number;
  vendor_name: string;
  payment_status: string;
}

export default function VendorPaymentReport() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Get PO lines with linked requisitions, GRNs, and payment info
      const { data: poLines } = await supabase
        .from('purchase_order_lines')
        .select(`
          quantity, unit_price, line_total,
          items(code, name),
          purchase_orders(po_number, vendor_id, vendors(name),
            ap_invoices(payment_status, status))
        `)
        .order('po_id');

      // Get requisition links
      const { data: traceLinks } = await supabase
        .from('po_line_requisition_lines')
        .select('po_line_id, requisition_lines(requisitions(req_number))');

      // Get GRN links
      const { data: grnLines } = await supabase
        .from('goods_receipt_lines')
        .select('po_line_id, goods_receipts(grn_number, status)');

      const reqMap = new Map<string, string>();
      (traceLinks || []).forEach((t: any) => {
        reqMap.set(t.po_line_id, t.requisition_lines?.requisitions?.req_number || '-');
      });

      const grnMap = new Map<string, string>();
      (grnLines || []).forEach((g: any) => {
        if (g.goods_receipts?.status === 'posted') {
          grnMap.set(g.po_line_id, g.goods_receipts.grn_number);
        }
      });

      const result: PaymentRow[] = [];
      (poLines || []).forEach((pl: any) => {
        const po = pl.purchase_orders;
        if (!po) return;
        const invoices = po.ap_invoices || [];
        const paymentStatus = invoices.length > 0
          ? (invoices.some((i: any) => i.payment_status === 'paid') ? 'paid' :
             invoices.some((i: any) => i.status === 'posted') ? 'invoiced' : 'pending')
          : 'not_invoiced';

        result.push({
          req_number: reqMap.get(pl.id) || '-',
          po_number: po.po_number,
          grn_number: grnMap.get(pl.id) || '-',
          item_name: pl.items?.name || '-',
          item_code: pl.items?.code || '-',
          quantity: pl.quantity,
          amount: pl.line_total || pl.quantity * pl.unit_price,
          vendor_name: po.vendors?.name || '-',
          payment_status: paymentStatus,
        });
      });

      setRows(result);
    } catch { } finally { setLoading(false); }
  };

  const filtered = rows.filter(r =>
    r.po_number.toLowerCase().includes(search.toLowerCase()) ||
    r.req_number.toLowerCase().includes(search.toLowerCase()) ||
    r.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    r.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'req_number', header: 'PRN No' },
    { key: 'po_number', header: 'PO Number' },
    { key: 'grn_number', header: 'GRN No' },
    { key: 'vendor_name', header: 'Vendor' },
    { key: 'item_name', header: 'Item', render: (r: PaymentRow) => <div><p className="font-medium">{r.item_name}</p><p className="text-xs text-muted-foreground">{r.item_code}</p></div> },
    { key: 'quantity', header: 'Qty', render: (r: PaymentRow) => r.quantity },
    { key: 'amount', header: 'Amount', render: (r: PaymentRow) => `₦${r.amount.toFixed(2)}` },
    { key: 'payment_status', header: 'Status', render: (r: PaymentRow) => <StatusBadge status={r.payment_status} /> },
  ];

  const exportCols = [
    { key: 'req_number', header: 'PRN No' },
    { key: 'po_number', header: 'PO Number' },
    { key: 'grn_number', header: 'GRN No' },
    { key: 'vendor_name', header: 'Vendor' },
    { key: 'item_name', header: 'Item' },
    { key: 'quantity', header: 'Qty' },
    { key: 'amount', header: 'Amount' },
    { key: 'payment_status', header: 'Status' },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Vendor Payment Report" description="Track payments from requisition to settlement"
          actions={<ExportButtons data={filtered} filename="vendor-payment-report" title="Vendor Payment Report" columns={exportCols} />} />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No payment data found." />
      </div>
    </AppLayout>
  );
}

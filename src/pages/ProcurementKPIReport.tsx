import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { useOrgBranding } from '@/hooks/useOrgBranding';

interface KPIRow {
  id: string;
  pr_number: string;
  pr_authorization_date: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  item_description: string;
  po_creation_date: string;
  po_authorization_date: string;
  po_delivery_date: string;
  item_category: string;
  order_status: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  discounted_price: number;
  qty_delivered: number;
  defective_units: number;
  delivery_state: string;
  job_location: string;
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

export default function ProcurementKPIReport() {
  const { appName, logoUrl } = useOrgBranding();
  const [dateFrom, setDateFrom] = useState(defaultFrom());
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery<KPIRow[]>({
    queryKey: ['procurement-kpi-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data: lines, error } = await supabase
        .from('purchase_order_lines')
        .select(`id, description, quantity, unit_price, line_total, qty_received,
          items(code, name, category),
          purchase_orders!inner(id, po_number, status, order_date, expected_date, approved_at, created_at,
            discount_type, discount_amount, subtotal, total_amount,
            vendors(id, code, name), locations:ship_to_location_id(name))`)
        .gte('purchase_orders.order_date', dateFrom)
        .lte('purchase_orders.order_date', dateTo);
      if (error) throw error;

      const poIds = Array.from(new Set((lines || []).map((l: any) => l.purchase_orders?.id).filter(Boolean)));
      const lineIds = (lines || []).map((l: any) => l.id);

      const [{ data: links }, { data: grns }] = await Promise.all([
        lineIds.length
          ? supabase
              .from('po_line_requisition_lines')
              .select('po_line_id, requisition_lines(requisitions(req_number, approved_at, submitted_at))')
              .in('po_line_id', lineIds)
          : Promise.resolve({ data: [] as any[] }),
        poIds.length
          ? supabase
              .from('goods_receipts')
              .select('po_id, receipt_date, status')
              .in('po_id', poIds)
              .eq('status', 'posted')
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const prByLine = new Map<string, any>();
      (links || []).forEach((l: any) => {
        const req = l.requisition_lines?.requisitions;
        if (req) prByLine.set(l.po_line_id, req);
      });

      const deliveryByPO = new Map<string, string>();
      (grns || []).forEach((g: any) => {
        const prev = deliveryByPO.get(g.po_id);
        if (!prev || g.receipt_date > prev) deliveryByPO.set(g.po_id, g.receipt_date);
      });

      return (lines || []).map((l: any) => {
        const po = l.purchase_orders;
        const req = prByLine.get(l.id);
        const qty = Number(l.quantity) || 0;
        const unit = Number(l.unit_price) || 0;
        const total = Number(l.line_total) || qty * unit;
        const subtotal = Number(po?.subtotal) || 0;
        const discAmt = Number(po?.discount_amount) || 0;
        const discRate =
          po?.discount_type === 'percentage'
            ? discAmt / 100
            : subtotal > 0
              ? discAmt / subtotal
              : 0;
        const received = Number(l.qty_received) || 0;
        return {
          id: l.id,
          pr_number: req?.req_number || '—',
          pr_authorization_date: req?.approved_at || '',
          po_number: po?.po_number || '—',
          supplier_id: po?.vendors?.code || '—',
          supplier_name: po?.vendors?.name || '—',
          item_description: l.items?.name || l.description || '—',
          po_creation_date: po?.created_at || po?.order_date || '',
          po_authorization_date: po?.approved_at || '',
          po_delivery_date: deliveryByPO.get(po?.id) || po?.expected_date || '',
          item_category: l.items?.category || '—',
          order_status: po?.status || '—',
          quantity: qty,
          unit_price: unit,
          total_value: total,
          discounted_price: total - total * discRate,
          qty_delivered: received,
          defective_units: Math.max(0, qty - received),
          delivery_state: received <= 0 ? 'Not delivered' : received >= qty ? 'Fully delivered' : 'Partially delivered',
          job_location: po?.locations?.name || '—',
        } as KPIRow;
      });
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return rows;
    return rows.filter(r =>
      [r.pr_number, r.po_number, r.supplier_name, r.item_description, r.item_category, r.job_location, r.order_status]
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const spend = filtered.reduce((s, r) => s + r.total_value, 0);
    const netSpend = filtered.reduce((s, r) => s + r.discounted_price, 0);
    const qty = filtered.reduce((s, r) => s + r.quantity, 0);
    const defects = filtered.reduce((s, r) => s + r.defective_units, 0);
    const cycles = filtered
      .filter(r => r.pr_authorization_date && r.po_creation_date)
      .map(r =>
        (new Date(r.po_creation_date).getTime() - new Date(r.pr_authorization_date).getTime()) / 86400000
      )
      .filter(n => n >= 0);
    const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;
    const delivered = filtered.filter(r => r.po_delivery_date);
    const suppliers = new Set(filtered.map(r => r.supplier_name)).size;
    return {
      spend,
      savings: spend - netSpend,
      lines: filtered.length,
      suppliers,
      defectRate: qty > 0 ? (defects / qty) * 100 : 0,
      fulfilment: filtered.length ? (delivered.length / filtered.length) * 100 : 0,
      avgCycle,
    };
  }, [filtered]);

  const columns = [
    { key: 'pr_number', header: 'PR No. (Requisition)' },
    { key: 'pr_authorization_date', header: 'PR Approval Date', render: (r: KPIRow) => fmtDate(r.pr_authorization_date) },
    { key: 'po_number', header: 'PO No.' },
    { key: 'supplier_id', header: 'Supplier ID' },
    { key: 'supplier_name', header: 'Supplier Name' },
    { key: 'item_description', header: 'Item Description' },
    { key: 'po_creation_date', header: 'PO Creation', render: (r: KPIRow) => fmtDate(r.po_creation_date) },
    { key: 'po_authorization_date', header: 'PO Auth. Date', render: (r: KPIRow) => fmtDate(r.po_authorization_date) },
    { key: 'po_delivery_date', header: 'PO Delivery', render: (r: KPIRow) => fmtDate(r.po_delivery_date) },
    { key: 'item_category', header: 'Item Category' },
    { key: 'order_status', header: 'Order Status', render: (r: KPIRow) => <Badge variant="outline">{r.order_status}</Badge> },
    { key: 'quantity', header: 'Quantity', render: (r: KPIRow) => r.quantity.toLocaleString() },
    { key: 'unit_price', header: 'Unit Price', render: (r: KPIRow) => formatCurrency(r.unit_price) },
    { key: 'total_value', header: 'Total Value', render: (r: KPIRow) => formatCurrency(r.total_value) },
    { key: 'discounted_price', header: 'Discounted Price', render: (r: KPIRow) => formatCurrency(r.discounted_price) },
    { key: 'qty_delivered', header: 'Qty Delivered', render: (r: KPIRow) => r.qty_delivered.toLocaleString() },
    { key: 'defective_units', header: 'Outstanding / Defective Units', render: (r: KPIRow) => r.defective_units.toLocaleString() },
    { key: 'delivery_state', header: 'Delivery Status', render: (r: KPIRow) => <Badge variant={r.delivery_state === 'Fully delivered' ? 'outline' : 'secondary'}>{r.delivery_state}</Badge> },
    { key: 'job_location', header: 'Job Location' },
  ];

  const exportCols = columns.map(c => ({ key: c.key, header: c.header }));
  const exportData = filtered.map(r => ({
    ...r,
    pr_authorization_date: fmtDate(r.pr_authorization_date),
    po_creation_date: fmtDate(r.po_creation_date),
    po_authorization_date: fmtDate(r.po_authorization_date),
    po_delivery_date: fmtDate(r.po_delivery_date),
    unit_price: r.unit_price.toFixed(2),
    total_value: r.total_value.toFixed(2),
    discounted_price: r.discounted_price.toFixed(2),
  }));

  const stats = [
    { label: 'Total Spend', value: formatCurrency(kpis.spend) },
    { label: 'Discount Savings', value: formatCurrency(kpis.savings) },
    { label: 'PO Lines', value: kpis.lines.toLocaleString() },
    { label: 'Suppliers', value: kpis.suppliers.toLocaleString() },
    { label: 'Avg PR→PO (days)', value: kpis.avgCycle.toFixed(1) },
    { label: 'Delivered Lines', value: `${kpis.fulfilment.toFixed(1)}%` },
    { label: 'Outstanding Qty Rate', value: `${kpis.defectRate.toFixed(1)}%` },
  ];

  return (
    <AppLayout>
      <div className="space-y-4">
        <PageHeader
          title="Procurement KPI Analysis"
          description="PR to PO to delivery performance, spend, savings and supplier metrics"
          actions={
            <ExportButtons
              data={exportData}
              filename="procurement-kpi-analysis"
              title="Procurement KPI Analysis"
              subtitle={`${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`}
              columns={exportCols}
              orgName={appName}
              logoUrl={logoUrl}
            />
          }
        />

        <Card>
          <CardContent className="pt-4 grid gap-3 md:grid-cols-3">
            <div>
              <Label>From (PO order date)</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label>Search</Label>
              <Input placeholder="PR, PO, supplier, item, category…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          {stats.map(s => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-4">
            <DataTable columns={columns as any} data={filtered} loading={isLoading} emptyMessage="No purchase order activity in this date range." />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

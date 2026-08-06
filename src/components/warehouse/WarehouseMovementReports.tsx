import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { useOrgBranding } from '@/hooks/useOrgBranding';

type ReportKind = 'received-items' | 'issued-items' | 'grn-list';

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

interface Props {
  kind: ReportKind;
}

export function WarehouseMovementReports({ kind }: Props) {
  const { appName, logoUrl } = useOrgBranding();
  const [locationId, setLocationId] = useState('all');
  const [dateFrom, setDateFrom] = useState(defaultFrom());
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: locations = [] } = useQuery({
    queryKey: ['wh-report-locations'],
    queryFn: async () => {
      const { data } = await supabase.from('locations').select('id, name').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['wh-movement-report', kind, locationId, dateFrom, dateTo],
    queryFn: async () => {
      if (kind === 'issued-items') {
        let q = supabase
          .from('inventory_issue_lines')
          .select('id, quantity, description, items(code, name, unit_cost), inventory_issues!inner(issue_number, issue_date, status, department, issued_to, location_id, locations(name))')
          .eq('inventory_issues.status', 'posted')
          .gte('inventory_issues.issue_date', dateFrom)
          .lte('inventory_issues.issue_date', dateTo);
        if (locationId !== 'all') q = q.eq('inventory_issues.location_id', locationId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || [])
          .map((r: any) => {
            const qty = Number(r.quantity) || 0;
            const cost = Number(r.items?.unit_cost) || 0;
            return {
              id: r.id,
              doc_number: r.inventory_issues?.issue_number || '',
              date: r.inventory_issues?.issue_date || '',
              location: r.inventory_issues?.locations?.name || '—',
              item_code: r.items?.code || '',
              item_name: r.items?.name || '',
              quantity: qty,
              unit_cost: cost,
              value: qty * cost,
              department: r.inventory_issues?.department || '—',
              issued_to: r.inventory_issues?.issued_to || '—',
            };
          })
          .sort((a, b) => (a.date < b.date ? 1 : -1));
      }

      if (kind === 'received-items') {
        let q = supabase
          .from('goods_receipt_lines')
          .select('id, qty_received, items(code, name, unit_cost), goods_receipts!inner(grn_number, receipt_date, status, location_id, weigh_bill_number, locations(name), purchase_orders(po_number, vendors(name)))')
          .eq('goods_receipts.status', 'posted')
          .gte('goods_receipts.receipt_date', dateFrom)
          .lte('goods_receipts.receipt_date', dateTo);
        if (locationId !== 'all') q = q.eq('goods_receipts.location_id', locationId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || [])
          .map((r: any) => {
            const qty = Number(r.qty_received) || 0;
            const cost = Number(r.items?.unit_cost) || 0;
            return {
              id: r.id,
              doc_number: r.goods_receipts?.grn_number || '',
              date: r.goods_receipts?.receipt_date || '',
              location: r.goods_receipts?.locations?.name || '—',
              item_code: r.items?.code || '',
              item_name: r.items?.name || '',
              quantity: qty,
              unit_cost: cost,
              value: qty * cost,
              po_number: r.goods_receipts?.purchase_orders?.po_number || '—',
              vendor: r.goods_receipts?.purchase_orders?.vendors?.name || '—',
            };
          })
          .sort((a, b) => (a.date < b.date ? 1 : -1));
      }

      let q = supabase
        .from('goods_receipts')
        .select('id, grn_number, receipt_date, status, weigh_bill_number, created_at, locations(name), purchase_orders(po_number, vendors(name)), goods_receipt_lines(qty_received)')
        .gte('receipt_date', dateFrom)
        .lte('receipt_date', dateTo)
        .order('receipt_date', { ascending: false });
      if (locationId !== 'all') q = q.eq('location_id', locationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        doc_number: r.grn_number,
        date: r.receipt_date,
        location: r.locations?.name || '—',
        po_number: r.purchase_orders?.po_number || '—',
        vendor: r.purchase_orders?.vendors?.name || '—',
        weigh_bill: r.weigh_bill_number || '—',
        lines: (r.goods_receipt_lines || []).length,
        quantity: (r.goods_receipt_lines || []).reduce((s: number, l: any) => s + (Number(l.qty_received) || 0), 0),
        status: r.status,
      }));
    },
  });

  const config = useMemo(() => {
    if (kind === 'issued-items') {
      return {
        title: 'Items Issued Out Report',
        filename: 'items-issued-report',
        columns: [
          { key: 'doc_number', header: 'Issue No.' },
          { key: 'date', header: 'Date' },
          { key: 'location', header: 'Location' },
          { key: 'item_code', header: 'Item Code' },
          { key: 'item_name', header: 'Item' },
          { key: 'quantity', header: 'Qty Issued' },
          { key: 'unit_cost', header: 'Unit Cost' },
          { key: 'value', header: 'Value' },
          { key: 'department', header: 'Department' },
          { key: 'issued_to', header: 'Issued To' },
        ],
      };
    }
    if (kind === 'received-items') {
      return {
        title: 'Items Received Report',
        filename: 'items-received-report',
        columns: [
          { key: 'doc_number', header: 'GRN No.' },
          { key: 'date', header: 'Date' },
          { key: 'location', header: 'Location' },
          { key: 'item_code', header: 'Item Code' },
          { key: 'item_name', header: 'Item' },
          { key: 'quantity', header: 'Qty Received' },
          { key: 'unit_cost', header: 'Unit Cost' },
          { key: 'value', header: 'Value' },
          { key: 'po_number', header: 'PO No.' },
          { key: 'vendor', header: 'Vendor' },
        ],
      };
    }
    return {
      title: 'Goods Received Notes Report',
      filename: 'goods-received-report',
      columns: [
        { key: 'doc_number', header: 'GRN No.' },
        { key: 'date', header: 'Receipt Date' },
        { key: 'location', header: 'Location' },
        { key: 'po_number', header: 'PO No.' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'weigh_bill', header: 'Weigh Bill' },
        { key: 'lines', header: 'Lines' },
        { key: 'quantity', header: 'Total Qty' },
        { key: 'status', header: 'Status' },
      ],
    };
  }, [kind]);

  const totalQty = rows.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
  const locationName = locationId === 'all' ? 'All locations' : (locations.find((l: any) => l.id === locationId) as any)?.name || '';
  const subtitle = `${locationName} · ${dateFrom} to ${dateTo}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{config.title}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{rows.length} rows · {totalQty.toLocaleString()} qty</Badge>
            <ExportButtons
              data={rows as any}
              filename={config.filename}
              title={config.title}
              subtitle={subtitle}
              columns={config.columns}
              orgName={orgName}
              logoUrl={logoUrl}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <DataTable
          columns={config.columns.map(c => ({
            ...c,
            render: (r: any) =>
              typeof r[c.key] === 'number' ? Number(r[c.key]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(r[c.key] ?? '—'),
          }))}
          data={rows as any}
          loading={isLoading}
          emptyMessage="No records for the selected location and date range."
        />
      </CardContent>
    </Card>
  );
}

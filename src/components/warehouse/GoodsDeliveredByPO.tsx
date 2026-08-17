import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { useOrgBranding } from '@/hooks/useOrgBranding';

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

interface Delivery {
  date: string;
  quantity: number;
  grn_number: string;
  location: string;
  weigh_bill: string;
}

export function GoodsDeliveredByPO() {
  const { appName, logoUrl } = useOrgBranding();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultFrom());
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['goods-delivered-by-po', dateFrom, dateTo],
    queryFn: async () => {
      const { data: grnLines, error } = await supabase
        .from('goods_receipt_lines')
        .select(
          'id, qty_received, po_line_id, items(code, name), goods_receipts!inner(grn_number, receipt_date, status, weigh_bill_number, locations(name))',
        )
        .eq('goods_receipts.status', 'posted')
        .gte('goods_receipts.receipt_date', dateFrom)
        .lte('goods_receipts.receipt_date', dateTo);
      if (error) throw error;

      const lineIds = Array.from(new Set((grnLines || []).map((l: any) => l.po_line_id).filter(Boolean)));
      let poLines: any[] = [];
      if (lineIds.length) {
        const { data, error: e2 } = await supabase
          .from('purchase_order_lines')
          .select(
            'id, description, quantity, unit_price, items(code, name), purchase_orders(po_number, order_date, status, vendors(name))',
          )
          .in('id', lineIds);
        if (e2) throw e2;
        poLines = data || [];
      }
      const poLineMap = new Map(poLines.map((l: any) => [l.id, l]));

      const grouped = new Map<string, any>();
      (grnLines || []).forEach((l: any) => {
        const key = l.po_line_id || `grn-${l.id}`;
        const pl: any = l.po_line_id ? poLineMap.get(l.po_line_id) : null;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            po_number: pl?.purchase_orders?.po_number || '— (no PO link)',
            order_date: pl?.purchase_orders?.order_date || '',
            vendor: pl?.purchase_orders?.vendors?.name || '—',
            item_code: pl?.items?.code || l.items?.code || '',
            item_name: pl?.items?.name || l.items?.name || pl?.description || '—',
            qty_ordered: Number(pl?.quantity) || 0,
            unit_price: Number(pl?.unit_price) || 0,
            qty_delivered: 0,
            deliveries: [] as Delivery[],
          });
        }
        const row = grouped.get(key);
        const qty = Number(l.qty_received) || 0;
        row.qty_delivered += qty;
        row.deliveries.push({
          date: l.goods_receipts?.receipt_date || '',
          quantity: qty,
          grn_number: l.goods_receipts?.grn_number || '',
          location: l.goods_receipts?.locations?.name || '—',
          weigh_bill: l.goods_receipts?.weigh_bill_number || '—',
        });
      });

      return Array.from(grouped.values())
        .map((r: any) => {
          r.deliveries.sort((a: Delivery, b: Delivery) => (a.date > b.date ? 1 : -1));
          const outstanding = Math.max(0, r.qty_ordered - r.qty_delivered);
          return {
            ...r,
            outstanding,
            deliveries_count: r.deliveries.length,
            delivery_dates: r.deliveries.map((d: Delivery) => `${d.date}: ${d.quantity}`).join(' | '),
            status: r.qty_ordered === 0 ? 'Received' : outstanding === 0 ? 'Fully delivered' : 'Partially delivered',
            value: r.qty_delivered * r.unit_price,
          };
        })
        .sort((a: any, b: any) => (a.po_number < b.po_number ? 1 : -1));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) =>
      [r.po_number, r.vendor, r.item_code, r.item_name].some((v: string) => String(v || '').toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const exportColumns = [
    { key: 'po_number', header: 'PO No.' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'item_code', header: 'Item Code' },
    { key: 'item_name', header: 'Item' },
    { key: 'qty_ordered', header: 'Qty Ordered' },
    { key: 'qty_delivered', header: 'Qty Delivered' },
    { key: 'outstanding', header: 'Outstanding' },
    { key: 'deliveries_count', header: 'No. of Deliveries' },
    { key: 'delivery_dates', header: 'Delivery Dates (date: qty)' },
    { key: 'status', header: 'Status' },
  ];

  const flatRows = filtered.flatMap((r: any) =>
    r.deliveries.map((d: Delivery) => ({
      po_number: r.po_number,
      vendor: r.vendor,
      item_code: r.item_code,
      item_name: r.item_name,
      qty_ordered: r.qty_ordered,
      delivery_date: d.date,
      quantity: d.quantity,
      grn_number: d.grn_number,
      location: d.location,
      weigh_bill: d.weigh_bill,
    })),
  );

  const flatColumns = [
    { key: 'po_number', header: 'PO No.' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'item_code', header: 'Item Code' },
    { key: 'item_name', header: 'Item' },
    { key: 'qty_ordered', header: 'Qty Ordered' },
    { key: 'delivery_date', header: 'Delivery Date' },
    { key: 'quantity', header: 'Qty Delivered' },
    { key: 'grn_number', header: 'GRN No.' },
    { key: 'location', header: 'Location' },
    { key: 'weigh_bill', header: 'Weigh Bill' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Goods Delivered by Purchase Order</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{filtered.length} PO lines · {flatRows.length} deliveries</Badge>
            <ExportButtons
              data={filtered as any}
              filename="goods-delivered-by-po"
              title="Goods Delivered by Purchase Order"
              subtitle={`${dateFrom} to ${dateTo}`}
              columns={exportColumns}
              orgName={appName}
              logoUrl={logoUrl}
            />
            <ExportButtons
              data={flatRows as any}
              filename="goods-delivered-schedule"
              title="Delivery Schedule (every delivery date)"
              subtitle={`${dateFrom} to ${dateTo}`}
              columns={flatColumns}
              orgName={appName}
              logoUrl={logoUrl}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Search (PO, vendor, item)</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. PO-00012 or Laptop" />
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

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>PO No.</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Deliveries</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No deliveries in the selected period.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => (
                <Fragment key={r.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpanded(p => ({ ...p, [r.id]: !p[r.id] }))}>
                    <TableCell>{expanded[r.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-medium">{r.po_number}</TableCell>
                    <TableCell>{r.vendor}</TableCell>
                    <TableCell>{r.item_code ? `${r.item_code} — ` : ''}{r.item_name}</TableCell>
                    <TableCell className="text-right">{r.qty_ordered.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.qty_delivered.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.outstanding.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.deliveries_count}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'Fully delivered' ? 'default' : 'secondary'}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                  {expanded[r.id] && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={8} className="bg-muted/40">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Delivery Date</TableHead>
                              <TableHead className="text-right">Qty Delivered</TableHead>
                              <TableHead>GRN No.</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Weigh Bill</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.deliveries.map((d: Delivery, i: number) => (
                              <TableRow key={i}>
                                <TableCell>{d.date}</TableCell>
                                <TableCell className="text-right">{d.quantity.toLocaleString()}</TableCell>
                                <TableCell>{d.grn_number}</TableCell>
                                <TableCell>{d.location}</TableCell>
                                <TableCell>{d.weigh_bill}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

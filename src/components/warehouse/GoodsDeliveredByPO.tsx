import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { useOrgBranding } from '@/hooks/useOrgBranding';

const ACTIVE_PO_STATUSES = ['approved', 'sent', 'partially_received', 'fully_received', 'closed'];

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
  const [applied, setApplied] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['goods-delivered-by-po'],
    queryFn: async () => {
      // 1. All PO lines on approved (or beyond) purchase orders
      const { data: poLines, error } = await supabase
        .from('purchase_order_lines')
        .select(
          'id, description, quantity, unit_price, items(code, name), purchase_orders!inner(po_number, order_date, status, vendors(name))',
        )
        .in('purchase_orders.status', ACTIVE_PO_STATUSES as any);
      if (error) throw error;

      // 2. Every posted GRN line (deliveries)
      const { data: grnLines, error: e2 } = await supabase
        .from('goods_receipt_lines')
        .select(
          'id, qty_received, po_line_id, items(code, name), goods_receipts!inner(grn_number, receipt_date, status, weigh_bill_number, locations(name))',
        )
        .eq('goods_receipts.status', 'posted');
      if (e2) throw e2;

      const map = new Map<string, any>();
      (poLines || []).forEach((pl: any) => {
        map.set(pl.id, {
          id: pl.id,
          po_number: pl.purchase_orders?.po_number || '—',
          po_status: pl.purchase_orders?.status || '',
          order_date: pl.purchase_orders?.order_date || '',
          vendor: pl.purchase_orders?.vendors?.name || '—',
          item_code: pl.items?.code || '',
          item_name: pl.items?.name || pl.description || '—',
          qty_ordered: Number(pl.quantity) || 0,
          unit_price: Number(pl.unit_price) || 0,
          qty_delivered: 0,
          deliveries: [] as Delivery[],
        });
      });

      (grnLines || []).forEach((l: any) => {
        const key = l.po_line_id || `grn-${l.id}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            po_number: '— (no PO link)',
            po_status: '',
            order_date: '',
            vendor: '—',
            item_code: l.items?.code || '',
            item_name: l.items?.name || '—',
            qty_ordered: 0,
            unit_price: 0,
            qty_delivered: 0,
            deliveries: [] as Delivery[],
          });
        }
        const row = map.get(key);
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

      return Array.from(map.values())
        .map((r: any) => {
          r.deliveries.sort((a: Delivery, b: Delivery) => (a.date > b.date ? 1 : -1));
          const outstanding = Math.max(0, r.qty_ordered - r.qty_delivered);
          return {
            ...r,
            outstanding,
            deliveries_count: r.deliveries.length,
            delivery_dates: r.deliveries.map((d: Delivery) => `${d.date}: ${d.quantity}`).join(' | '),
            status:
              r.qty_delivered === 0
                ? 'Awaiting delivery'
                : outstanding === 0 && r.qty_ordered > 0
                  ? 'Fully delivered'
                  : 'Partially delivered',
            value: r.qty_delivered * r.unit_price,
          };
        })
        .sort((a: any, b: any) => (a.po_number < b.po_number ? 1 : -1));
    },
  });

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) =>
      [r.po_number, r.vendor, r.item_code, r.item_name].some((v: string) => String(v || '').toLowerCase().includes(q)),
    );
  }, [rows, applied]);

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
              subtitle={applied ? `Filtered by: ${applied}` : 'All approved purchase orders'}
              columns={exportColumns}
              orgName={appName}
              logoUrl={logoUrl}
            />
            <ExportButtons
              data={flatRows as any}
              filename="goods-delivered-schedule"
              title="Delivery Schedule (every delivery date)"
              subtitle={applied ? `Filtered by: ${applied}` : 'All approved purchase orders'}
              columns={flatColumns}
              orgName={appName}
              logoUrl={logoUrl}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <Label>Purchase Order (or vendor / item)</Label>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setApplied(search); }}
              placeholder="e.g. PO-00012"
            />
          </div>
          <Button onClick={() => setApplied(search)}>
            <Search className="h-4 w-4 mr-2" /> Retrieve
          </Button>
          <Button variant="outline" onClick={() => { setSearch(''); setApplied(''); }}>Show all</Button>
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
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {rows.length === 0
                      ? 'No approved purchase orders yet. Once a PO is approved its lines appear here, even before any delivery.'
                      : `No purchase order matches "${applied}". Check the PO number or click Show all.`}
                  </TableCell>
                </TableRow>
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
                      <Badge variant={r.status === 'Fully delivered' ? 'default' : r.status === 'Awaiting delivery' ? 'outline' : 'secondary'}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                  {expanded[r.id] && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={8} className="bg-muted/40">
                        {r.deliveries.length === 0 ? (
                          <div className="py-3 text-sm text-muted-foreground">No deliveries received yet for this line.</div>
                        ) : (
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
                        )}
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

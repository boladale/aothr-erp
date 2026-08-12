import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { useOrgBranding } from '@/hooks/useOrgBranding';
import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { formatCurrency } from '@/lib/currency';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
type Kind = 'inbound' | 'requisitions' | 'outbound' | 'adjustments' | 'summary' | 'ageing' | 'expiration';

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

function periodKey(dateStr: string, period: Period) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  if (period === 'daily') return d.toISOString().slice(0, 10);
  if (period === 'yearly') return String(d.getUTCFullYear());
  if (period === 'monthly') return d.toISOString().slice(0, 7);
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const daysBetween = (a: number, b: number) => Math.floor((a - b) / 86400000);

interface SectionProps {
  kind: Kind;
  periods: Period[];
}

function ReportSection({ kind, periods }: SectionProps) {
  const { appName, logoUrl } = useOrgBranding();
  const { baseCurrency } = useOrgCurrency();
  const [period, setPeriod] = useState<Period>(periods[0]);
  const [locationId, setLocationId] = useState('all');
  const [dateFrom, setDateFrom] = useState(monthsAgo(12));
  const [dateTo, setDateTo] = useState(today());
  const [view, setView] = useState<'summary' | 'detail'>('summary');

  const isStockSnapshot = kind === 'ageing' || kind === 'expiration';

  const { data: locations = [] } = useQuery({
    queryKey: ['inv-report-locations'],
    queryFn: async () => {
      const { data } = await supabase.from('locations').select('id, name').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inventory-report', kind, locationId, dateFrom, dateTo],
    queryFn: async () => {
      const inRange = (d: string) => d >= dateFrom && d <= dateTo;

      if (kind === 'inbound') {
        let q = supabase
          .from('goods_receipt_lines')
          .select('id, qty_received, items(code, name, unit_cost, unit_of_measure), goods_receipts!inner(grn_number, receipt_date, status, location_id, locations(name), purchase_orders(po_number, vendors(name)))')
          .eq('goods_receipts.status', 'posted')
          .gte('goods_receipts.receipt_date', dateFrom)
          .lte('goods_receipts.receipt_date', dateTo);
        if (locationId !== 'all') q = q.eq('goods_receipts.location_id', locationId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((r: any) => {
          const qty = Number(r.qty_received) || 0;
          const cost = Number(r.items?.unit_cost) || 0;
          return {
            id: r.id,
            date: r.goods_receipts?.receipt_date || '',
            doc_number: r.goods_receipts?.grn_number || '',
            location: r.goods_receipts?.locations?.name || '—',
            item_code: r.items?.code || '',
            item_name: r.items?.name || '',
            uom: r.items?.unit_of_measure || '',
            quantity: qty,
            unit_cost: cost,
            value: qty * cost,
            reference: r.goods_receipts?.purchase_orders?.po_number || '—',
            party: r.goods_receipts?.purchase_orders?.vendors?.name || '—',
          };
        });
      }

      if (kind === 'requisitions') {
        const { data, error } = await supabase
          .from('requisition_lines')
          .select('id, quantity, estimated_unit_cost, estimated_total, qty_converted, items(code, name, unit_of_measure), requisitions!inner(req_number, request_date, status, department, requester_name)')
          .gte('requisitions.request_date', dateFrom)
          .lte('requisitions.request_date', dateTo);
        if (error) throw error;
        return (data || []).map((r: any) => {
          const qty = Number(r.quantity) || 0;
          const cost = Number(r.estimated_unit_cost) || 0;
          return {
            id: r.id,
            date: r.requisitions?.request_date || '',
            doc_number: r.requisitions?.req_number || '',
            location: '—',
            item_code: r.items?.code || '',
            item_name: r.items?.name || '',
            uom: r.items?.unit_of_measure || '',
            quantity: qty,
            unit_cost: cost,
            value: Number(r.estimated_total) || qty * cost,
            qty_converted: Number(r.qty_converted) || 0,
            reference: r.requisitions?.department || '—',
            party: r.requisitions?.requester_name || '—',
            status: r.requisitions?.status || '',
          };
        });
      }

      if (kind === 'outbound') {
        let q = supabase
          .from('inventory_issue_lines')
          .select('id, quantity, items(code, name, unit_cost, unit_of_measure), inventory_issues!inner(issue_number, issue_date, status, department, issued_to, location_id, locations(name))')
          .eq('inventory_issues.status', 'posted')
          .gte('inventory_issues.issue_date', dateFrom)
          .lte('inventory_issues.issue_date', dateTo);
        if (locationId !== 'all') q = q.eq('inventory_issues.location_id', locationId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((r: any) => {
          const qty = Number(r.quantity) || 0;
          const cost = Number(r.items?.unit_cost) || 0;
          return {
            id: r.id,
            date: r.inventory_issues?.issue_date || '',
            doc_number: r.inventory_issues?.issue_number || '',
            location: r.inventory_issues?.locations?.name || '—',
            item_code: r.items?.code || '',
            item_name: r.items?.name || '',
            uom: r.items?.unit_of_measure || '',
            quantity: qty,
            unit_cost: cost,
            value: qty * cost,
            reference: r.inventory_issues?.department || '—',
            party: r.inventory_issues?.issued_to || '—',
          };
        });
      }

      if (kind === 'adjustments') {
        let q = supabase
          .from('inventory_adjustment_lines')
          .select('id, quantity, adjustment_type, notes, items(code, name, unit_cost, unit_of_measure), inventory_adjustments!inner(adjustment_number, adjustment_date, status, reason, location_id, locations(name))')
          .eq('inventory_adjustments.status', 'posted')
          .gte('inventory_adjustments.adjustment_date', dateFrom)
          .lte('inventory_adjustments.adjustment_date', dateTo);
        if (locationId !== 'all') q = q.eq('inventory_adjustments.location_id', locationId);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((r: any) => {
          const raw = Number(r.quantity) || 0;
          const isDecrease = String(r.adjustment_type || '').toLowerCase().includes('decrease');
          const qty = isDecrease ? -Math.abs(raw) : Math.abs(raw);
          const cost = Number(r.items?.unit_cost) || 0;
          return {
            id: r.id,
            date: r.inventory_adjustments?.adjustment_date || '',
            doc_number: r.inventory_adjustments?.adjustment_number || '',
            location: r.inventory_adjustments?.locations?.name || '—',
            item_code: r.items?.code || '',
            item_name: r.items?.name || '',
            uom: r.items?.unit_of_measure || '',
            quantity: qty,
            unit_cost: cost,
            value: qty * cost,
            reference: r.adjustment_type || '—',
            party: r.inventory_adjustments?.reason || r.notes || '—',
          };
        });
      }

      if (kind === 'summary') {
        const [grn, iss, adj, trf] = await Promise.all([
          supabase
            .from('goods_receipt_lines')
            .select('qty_received, items(unit_cost), goods_receipts!inner(receipt_date, status, location_id)')
            .eq('goods_receipts.status', 'posted')
            .gte('goods_receipts.receipt_date', dateFrom)
            .lte('goods_receipts.receipt_date', dateTo),
          supabase
            .from('inventory_issue_lines')
            .select('quantity, items(unit_cost), inventory_issues!inner(issue_date, status, location_id)')
            .eq('inventory_issues.status', 'posted')
            .gte('inventory_issues.issue_date', dateFrom)
            .lte('inventory_issues.issue_date', dateTo),
          supabase
            .from('inventory_adjustment_lines')
            .select('quantity, adjustment_type, items(unit_cost), inventory_adjustments!inner(adjustment_date, status, location_id)')
            .eq('inventory_adjustments.status', 'posted')
            .gte('inventory_adjustments.adjustment_date', dateFrom)
            .lte('inventory_adjustments.adjustment_date', dateTo),
          supabase
            .from('inventory_transfer_lines')
            .select('quantity, unit_cost, inventory_transfers!inner(transfer_date, status, from_location_id, to_location_id)')
            .eq('inventory_transfers.status', 'posted')
            .gte('inventory_transfers.transfer_date', dateFrom)
            .lte('inventory_transfers.transfer_date', dateTo),
        ]);

        const out: any[] = [];
        (grn.data || []).forEach((r: any, i: number) => {
          if (locationId !== 'all' && r.goods_receipts?.location_id !== locationId) return;
          const qty = Number(r.qty_received) || 0;
          const cost = Number(r.items?.unit_cost) || 0;
          out.push({ id: `g${i}`, date: r.goods_receipts?.receipt_date, bucket: 'received', quantity: qty, value: qty * cost });
        });
        (iss.data || []).forEach((r: any, i: number) => {
          if (locationId !== 'all' && r.inventory_issues?.location_id !== locationId) return;
          const qty = Number(r.quantity) || 0;
          const cost = Number(r.items?.unit_cost) || 0;
          out.push({ id: `i${i}`, date: r.inventory_issues?.issue_date, bucket: 'issued', quantity: qty, value: qty * cost });
        });
        (adj.data || []).forEach((r: any, i: number) => {
          if (locationId !== 'all' && r.inventory_adjustments?.location_id !== locationId) return;
          const raw = Number(r.quantity) || 0;
          const isDecrease = String(r.adjustment_type || '').toLowerCase().includes('decrease');
          const qty = isDecrease ? -Math.abs(raw) : Math.abs(raw);
          const cost = Number(r.items?.unit_cost) || 0;
          out.push({ id: `a${i}`, date: r.inventory_adjustments?.adjustment_date, bucket: 'adjusted', quantity: qty, value: qty * cost });
        });
        (trf.data || []).forEach((r: any, i: number) => {
          const t = r.inventory_transfers;
          const qty = Number(r.quantity) || 0;
          const cost = Number(r.unit_cost) || 0;
          if (locationId === 'all' || t?.from_location_id === locationId) {
            out.push({ id: `to${i}`, date: t?.transfer_date, bucket: 'transfer_out', quantity: qty, value: qty * cost });
          }
          if (locationId === 'all' || t?.to_location_id === locationId) {
            out.push({ id: `ti${i}`, date: t?.transfer_date, bucket: 'transfer_in', quantity: qty, value: qty * cost });
          }
        });
        return out.filter(r => r.date && inRange(r.date));
      }

      // Ageing / Expiration — stock snapshot from FIFO layers
      let lq = supabase
        .from('inventory_costing_layers')
        .select('id, receipt_date, remaining_qty, unit_cost, location_id, item_id, locations(name), items(code, name, unit_of_measure, shelf_life_days, expiry_date)')
        .gt('remaining_qty', 0);
      if (locationId !== 'all') lq = lq.eq('location_id', locationId);
      const { data, error } = await lq;
      if (error) throw error;
      const now = Date.now();

      const base = (data || []).map((r: any) => {
        const qty = Number(r.remaining_qty) || 0;
        const cost = Number(r.unit_cost) || 0;
        const received = r.receipt_date;
        const age = received ? daysBetween(now, new Date(received).getTime()) : 0;
        const shelf = Number(r.items?.shelf_life_days) || 0;
        const fixedExpiry = r.items?.expiry_date || null;
        let expiry: string | null = fixedExpiry;
        if (!expiry && shelf > 0 && received) {
          const e = new Date(received);
          e.setDate(e.getDate() + shelf);
          expiry = e.toISOString().slice(0, 10);
        }
        const daysToExpiry = expiry ? daysBetween(new Date(expiry).getTime(), now) : null;
        return {
          id: r.id,
          item_code: r.items?.code || '',
          item_name: r.items?.name || '',
          uom: r.items?.unit_of_measure || '',
          location: r.locations?.name || '—',
          received_date: received || '—',
          quantity: qty,
          unit_cost: cost,
          value: qty * cost,
          age_days: age,
          age_bucket: age <= 30 ? '0-30 days' : age <= 60 ? '31-60 days' : age <= 90 ? '61-90 days' : age <= 180 ? '91-180 days' : age <= 365 ? '181-365 days' : 'Over 365 days',
          expiry_date: expiry || '—',
          days_to_expiry: daysToExpiry,
        };
      });

      if (kind === 'expiration') {
        return base
          .filter(r => r.days_to_expiry !== null && (r.days_to_expiry as number) <= 90)
          .sort((a, b) => (a.days_to_expiry as number) - (b.days_to_expiry as number));
      }
      return base.sort((a, b) => b.age_days - a.age_days);
    },
  });

  const config = useMemo(() => {
    switch (kind) {
      case 'inbound':
        return {
          title: 'Material Received Report (Inbound)',
          filename: 'material-received-report',
          detailColumns: [
            { key: 'date', header: 'Date' }, { key: 'doc_number', header: 'GRN No.' }, { key: 'location', header: 'Location' },
            { key: 'item_code', header: 'Item Code' }, { key: 'item_name', header: 'Material' }, { key: 'uom', header: 'UoM' },
            { key: 'quantity', header: 'Qty Received' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'value', header: 'Value' },
            { key: 'reference', header: 'PO No.' }, { key: 'party', header: 'Vendor' },
          ],
        };
      case 'requisitions':
        return {
          title: 'Material Requisitions Report',
          filename: 'material-requisitions-report',
          detailColumns: [
            { key: 'date', header: 'Date' }, { key: 'doc_number', header: 'Requisition No.' }, { key: 'item_code', header: 'Item Code' },
            { key: 'item_name', header: 'Material' }, { key: 'uom', header: 'UoM' }, { key: 'quantity', header: 'Qty Requested' },
            { key: 'qty_converted', header: 'Qty Converted' }, { key: 'unit_cost', header: 'Est. Unit Cost' }, { key: 'value', header: 'Est. Value' },
            { key: 'reference', header: 'Department' }, { key: 'party', header: 'Requested By' }, { key: 'status', header: 'Status' },
          ],
        };
      case 'outbound':
        return {
          title: 'Material Issued Report (Outbound)',
          filename: 'material-issued-report',
          detailColumns: [
            { key: 'date', header: 'Date' }, { key: 'doc_number', header: 'Issue No.' }, { key: 'location', header: 'Location' },
            { key: 'item_code', header: 'Item Code' }, { key: 'item_name', header: 'Material' }, { key: 'uom', header: 'UoM' },
            { key: 'quantity', header: 'Qty Issued' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'value', header: 'Value' },
            { key: 'reference', header: 'Department' }, { key: 'party', header: 'Issued To' },
          ],
        };
      case 'adjustments':
        return {
          title: 'Inventory Adjustment Report',
          filename: 'inventory-adjustment-report',
          detailColumns: [
            { key: 'date', header: 'Date' }, { key: 'doc_number', header: 'Adj. No.' }, { key: 'location', header: 'Location' },
            { key: 'item_code', header: 'Item Code' }, { key: 'item_name', header: 'Material' }, { key: 'uom', header: 'UoM' },
            { key: 'quantity', header: 'Qty Adjusted' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'value', header: 'Value Impact' },
            { key: 'reference', header: 'Type' }, { key: 'party', header: 'Reason' },
          ],
        };
      case 'ageing':
        return {
          title: 'Material Ageing Report',
          filename: 'material-ageing-report',
          detailColumns: [
            { key: 'item_code', header: 'Item Code' }, { key: 'item_name', header: 'Material' }, { key: 'location', header: 'Location' },
            { key: 'received_date', header: 'Received' }, { key: 'age_days', header: 'Age (days)' }, { key: 'age_bucket', header: 'Ageing Bucket' },
            { key: 'quantity', header: 'Qty On Hand' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'value', header: 'Value' },
          ],
        };
      case 'expiration':
        return {
          title: 'Material Expiration Report (next 3 months)',
          filename: 'material-expiration-report',
          detailColumns: [
            { key: 'item_code', header: 'Item Code' }, { key: 'item_name', header: 'Material' }, { key: 'location', header: 'Location' },
            { key: 'received_date', header: 'Received' }, { key: 'expiry_date', header: 'Expiry Date' }, { key: 'days_to_expiry', header: 'Days To Expiry' },
            { key: 'quantity', header: 'Qty At Risk' }, { key: 'unit_cost', header: 'Unit Cost' }, { key: 'value', header: 'Value At Risk' },
          ],
        };
      default:
        return {
          title: 'Inventory Summary Report (end-to-end movement)',
          filename: 'inventory-summary-report',
          detailColumns: [],
        };
    }
  }, [kind]);

  // Period aggregation
  const summaryRows = useMemo(() => {
    if (isStockSnapshot) {
      const map: Record<string, any> = {};
      (rows as any[]).forEach(r => {
        const key = kind === 'ageing' ? r.age_bucket : (r.days_to_expiry < 0 ? 'Expired' : r.days_to_expiry <= 30 ? 'Within 30 days' : r.days_to_expiry <= 60 ? '31-60 days' : '61-90 days');
        if (!map[key]) map[key] = { id: key, bucket: key, items: new Set(), quantity: 0, value: 0 };
        map[key].items.add(r.item_code + r.item_name);
        map[key].quantity += r.quantity;
        map[key].value += r.value;
      });
      const order = kind === 'ageing'
        ? ['0-30 days', '31-60 days', '61-90 days', '91-180 days', '181-365 days', 'Over 365 days']
        : ['Expired', 'Within 30 days', '31-60 days', '61-90 days'];
      return order.filter(k => map[k]).map(k => ({ ...map[k], items: map[k].items.size }));
    }

    if (kind === 'summary') {
      const map: Record<string, any> = {};
      (rows as any[]).forEach(r => {
        const key = periodKey(r.date, period);
        if (!map[key]) map[key] = { id: key, period: key, received: 0, issued: 0, adjusted: 0, transfer_in: 0, transfer_out: 0, received_value: 0, issued_value: 0 };
        if (r.bucket === 'received') { map[key].received += r.quantity; map[key].received_value += r.value; }
        if (r.bucket === 'issued') { map[key].issued += r.quantity; map[key].issued_value += r.value; }
        if (r.bucket === 'adjusted') map[key].adjusted += r.quantity;
        if (r.bucket === 'transfer_in') map[key].transfer_in += r.quantity;
        if (r.bucket === 'transfer_out') map[key].transfer_out += r.quantity;
      });
      return Object.values(map)
        .map((m: any) => ({ ...m, net_movement: m.received + m.adjusted + m.transfer_in - m.issued - m.transfer_out }))
        .sort((a: any, b: any) => (a.period < b.period ? 1 : -1));
    }

    const map: Record<string, any> = {};
    (rows as any[]).forEach(r => {
      const key = periodKey(r.date, period);
      if (!map[key]) map[key] = { id: key, period: key, documents: new Set(), lines: 0, quantity: 0, value: 0 };
      map[key].documents.add(r.doc_number);
      map[key].lines += 1;
      map[key].quantity += r.quantity;
      map[key].value += r.value;
    });
    return Object.values(map)
      .map((m: any) => ({ ...m, documents: m.documents.size }))
      .sort((a: any, b: any) => (a.period < b.period ? 1 : -1));
  }, [rows, period, kind, isStockSnapshot]);

  const summaryColumns = useMemo(() => {
    if (isStockSnapshot) {
      return [
        { key: 'bucket', header: kind === 'ageing' ? 'Ageing Bucket' : 'Expiry Window' },
        { key: 'items', header: 'Materials' },
        { key: 'quantity', header: 'Quantity' },
        { key: 'value', header: 'Value' },
      ];
    }
    if (kind === 'summary') {
      return [
        { key: 'period', header: 'Period' },
        { key: 'received', header: 'Received In' },
        { key: 'transfer_in', header: 'Transfer In' },
        { key: 'adjusted', header: 'Adjustments' },
        { key: 'issued', header: 'Issued Out' },
        { key: 'transfer_out', header: 'Transfer Out' },
        { key: 'net_movement', header: 'Net Movement' },
        { key: 'received_value', header: 'Inbound Value' },
        { key: 'issued_value', header: 'Outbound Value' },
      ];
    }
    return [
      { key: 'period', header: 'Period' },
      { key: 'documents', header: 'Documents' },
      { key: 'lines', header: 'Lines' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'value', header: kind === 'requisitions' ? 'Estimated Value' : 'Value' },
    ];
  }, [kind, isStockSnapshot]);

  const activeColumns = view === 'summary' || kind === 'summary' ? summaryColumns : config.detailColumns;
  const activeRows: any[] = view === 'summary' || kind === 'summary' ? summaryRows : (rows as any[]);

  const totalQty = activeRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalValue = activeRows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const locationName = locationId === 'all' ? 'All locations' : (locations.find((l: any) => l.id === locationId) as any)?.name || '';
  const subtitle = isStockSnapshot
    ? `${locationName} · as at ${today()}`
    : `${locationName} · ${dateFrom} to ${dateTo} · ${period}`;

  const valueKeys = ['value', 'unit_cost', 'received_value', 'issued_value'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{config.title}</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {activeRows.length} rows · {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} qty · {formatCurrency(totalValue, baseCurrency)}
            </Badge>
            <ExportButtons
              data={activeRows}
              filename={config.filename}
              title={config.title}
              subtitle={subtitle}
              columns={activeColumns}
              orgName={appName}
              logoUrl={logoUrl}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {!isStockSnapshot && (
            <div className="space-y-1">
              <Label>Period</Label>
              <Select value={period} onValueChange={v => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periods.map(p => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l: any) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {!isStockSnapshot && (
            <>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </>
          )}
          {kind !== 'summary' && (
            <div className="space-y-1">
              <Label>View</Label>
              <Select value={view} onValueChange={v => setView(v as 'summary' | 'detail')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">{isStockSnapshot ? 'Bucket summary' : 'Period summary'}</SelectItem>
                  <SelectItem value="detail">Line detail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DataTable
          columns={activeColumns.map(c => ({
            ...c,
            render: (r: any) => {
              const v = r[c.key];
              if (typeof v === 'number') {
                return valueKeys.includes(c.key)
                  ? formatCurrency(v, baseCurrency)
                  : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
              }
              return String(v ?? '—');
            },
          }))}
          data={activeRows}
          loading={isLoading}
          emptyMessage="No records for the selected filters."
        />
      </CardContent>
    </Card>
  );
}

export default function InventoryReports() {
  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Inventory Reports"
          description="Material inbound, requisitions, outbound, adjustments, end-to-end summary, ageing and expiration"
        />
        <Tabs defaultValue="inbound">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="inbound">Material Received</TabsTrigger>
            <TabsTrigger value="requisitions">Material Requisitions</TabsTrigger>
            <TabsTrigger value="outbound">Material Issued</TabsTrigger>
            <TabsTrigger value="adjustments">Inventory Adjustments</TabsTrigger>
            <TabsTrigger value="summary">Inventory Summary</TabsTrigger>
            <TabsTrigger value="ageing">Material Ageing</TabsTrigger>
            <TabsTrigger value="expiration">Material Expiration</TabsTrigger>
          </TabsList>

          <TabsContent value="inbound"><ReportSection kind="inbound" periods={['daily', 'weekly', 'monthly', 'yearly']} /></TabsContent>
          <TabsContent value="requisitions"><ReportSection kind="requisitions" periods={['daily', 'weekly', 'monthly', 'yearly']} /></TabsContent>
          <TabsContent value="outbound"><ReportSection kind="outbound" periods={['daily', 'monthly', 'yearly']} /></TabsContent>
          <TabsContent value="adjustments"><ReportSection kind="adjustments" periods={['daily', 'monthly', 'yearly']} /></TabsContent>
          <TabsContent value="summary"><ReportSection kind="summary" periods={['daily', 'monthly', 'yearly']} /></TabsContent>
          <TabsContent value="ageing"><ReportSection kind="ageing" periods={['monthly']} /></TabsContent>
          <TabsContent value="expiration"><ReportSection kind="expiration" periods={['monthly']} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

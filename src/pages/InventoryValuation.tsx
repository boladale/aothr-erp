import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, Layers, Package, Clock, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { exportToXLSX } from '@/lib/export-utils';
import { Download } from 'lucide-react';

interface CostingLayer {
  id: string;
  item_id: string;
  location_id: string;
  source_type: string;
  receipt_date: string;
  original_qty: number;
  remaining_qty: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  items: { code: string; name: string; unit_of_measure: string; category: string | null } | null;
  locations: { code: string; name: string } | null;
}

interface BalanceRow {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  items: { code: string; name: string; unit_of_measure: string; unit_cost: number | null; category: string | null } | null;
  locations: { code: string; name: string } | null;
}

interface ValuationSummary {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  location_id: string;
  location_name: string;
  total_qty: number;
  unit_cost: number;
  total_value: number;
  layer_count: number;
  uom: string;
}

interface AgingBucket {
  label: string;
  value: number;
  qty: number;
}

interface GLAccountBalance {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}


export default function InventoryValuation() {
  const [layers, setLayers] = useState<CostingLayer[]>([]);
  const [allLayers, setAllLayers] = useState<CostingLayer[]>([]);
  const [consumptions, setConsumptions] = useState<Array<{ layer_id: string; quantity: number; consumed_at: string }>>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [glInventory, setGlInventory] = useState<GLAccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [layersRes, allLayersRes, consRes, balancesRes, glAcctsRes] = await Promise.all([
        supabase
          .from('inventory_costing_layers')
          .select('*, items(code, name, unit_of_measure, category), locations(code, name)')
          .gt('remaining_qty', 0)
          .order('receipt_date', { ascending: true }),
        supabase
          .from('inventory_costing_layers')
          .select('*, items(code, name, unit_of_measure, category), locations(code, name)')
          .order('receipt_date', { ascending: true }),
        supabase
          .from('inventory_costing_consumptions')
          .select('layer_id, quantity, consumed_at'),
        supabase
          .from('inventory_balances')
          .select('*, items(code, name, unit_of_measure, unit_cost, category), locations(code, name)')
          .gt('quantity', 0),
        supabase
          .from('gl_accounts')
          .select('id, account_code, account_name')
          .like('account_code', '14%')
          .eq('is_active', true),
      ]);

      if (layersRes.error) throw layersRes.error;
      if (allLayersRes.error) throw allLayersRes.error;
      if (consRes.error) throw consRes.error;
      if (balancesRes.error) throw balancesRes.error;
      if (glAcctsRes.error) throw glAcctsRes.error;
      setLayers((layersRes.data || []) as unknown as CostingLayer[]);
      setAllLayers((allLayersRes.data || []) as unknown as CostingLayer[]);
      setConsumptions((consRes.data || []) as any);
      setBalances((balancesRes.data || []) as unknown as BalanceRow[]);

      // Sum posted journal lines per inventory account
      const accts = (glAcctsRes.data || []) as Array<{ id: string; account_code: string; account_name: string }>;
      const acctIds = accts.map(a => a.id);
      let gl: GLAccountBalance[] = [];
      if (acctIds.length > 0) {
        const { data: linesData, error: linesErr } = await supabase
          .from('gl_journal_lines')
          .select('account_id, debit, credit, gl_journal_entries!inner(status)')
          .in('account_id', acctIds)
          .eq('gl_journal_entries.status', 'posted');
        if (linesErr) throw linesErr;
        const sums = new Map<string, { d: number; c: number }>();
        (linesData || []).forEach((l: any) => {
          const s = sums.get(l.account_id) || { d: 0, c: 0 };
          s.d += Number(l.debit || 0);
          s.c += Number(l.credit || 0);
          sums.set(l.account_id, s);
        });
        gl = accts.map(a => {
          const s = sums.get(a.id) || { d: 0, c: 0 };
          return {
            id: a.id,
            account_id: a.id,

            account_code: a.account_code,
            account_name: a.account_name,
            debit: s.d,
            credit: s.c,
            balance: s.d - s.c,
          };
        }).filter(g => g.debit !== 0 || g.credit !== 0);
      }
      setGlInventory(gl);
    } catch (error) {
      console.error('Error fetching inventory valuation:', error);
      toast.error('Failed to load inventory valuation');
    } finally {
      setLoading(false);
    }
  };


  // Aggregate FIFO layers per item+location for weighted-avg cost + layer count
  const layerAgg = new Map<string, { qty: number; value: number; count: number }>();
  layers.forEach(l => {
    const key = `${l.item_id}-${l.location_id}`;
    const existing = layerAgg.get(key) || { qty: 0, value: 0, count: 0 };
    existing.qty += Number(l.remaining_qty);
    existing.value += Number(l.remaining_qty) * Number(l.unit_cost);
    existing.count += 1;
    layerAgg.set(key, existing);
  });

  // Build summary from balances (source of truth for qty), enriched with FIFO cost when present
  const allSummaries: ValuationSummary[] = balances.map(b => {
    const key = `${b.item_id}-${b.location_id}`;
    const agg = layerAgg.get(key);
    const qty = Number(b.quantity);
    const unitCost = agg && agg.qty > 0
      ? agg.value / agg.qty
      : Number(b.items?.unit_cost || 0);
    return {
      id: key,
      item_code: b.items?.code || '',
      item_name: b.items?.name || '',
      category: b.items?.category || 'Uncategorized',
      location_id: b.location_id,
      location_name: b.locations?.name || '',
      total_qty: qty,
      unit_cost: unitCost,
      total_value: qty * unitCost,
      layer_count: agg?.count || 0,
      uom: b.items?.unit_of_measure || 'EA',
    };
  });

  const categories = Array.from(new Set(allSummaries.map(s => s.category))).sort();
  const locationOptions = Array.from(
    new Map(allSummaries.map(s => [s.location_id, s.location_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const summaries = allSummaries.filter(s => {
    const matchSearch =
      s.item_name.toLowerCase().includes(search.toLowerCase()) ||
      s.item_code.toLowerCase().includes(search.toLowerCase()) ||
      s.location_name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchLocation = locationFilter === 'all' || s.location_id === locationFilter;
    return matchSearch && matchCategory && matchLocation;
  });

  const totalInventoryValue = summaries.reduce((sum, s) => sum + s.total_value, 0);
  // Unfiltered total for GL reconciliation so search/category/location filters don't affect the match
  const totalInventoryValueAll = allSummaries.reduce((sum, s) => sum + s.total_value, 0);
  const totalQty = summaries.reduce((sum, s) => sum + s.total_qty, 0);
  const totalItems = summaries.length;
  const totalLayers = layers.length;

  // Aging buckets
  const now = new Date();
  const aging: AgingBucket[] = [
    { label: '0-30 days', value: 0, qty: 0 },
    { label: '31-60 days', value: 0, qty: 0 },
    { label: '61-90 days', value: 0, qty: 0 },
    { label: '90+ days', value: 0, qty: 0 },
  ];

  layers.forEach(l => {
    const days = Math.floor((now.getTime() - new Date(l.receipt_date).getTime()) / (1000 * 60 * 60 * 24));
    const val = l.remaining_qty * l.unit_cost;
    if (days <= 30) { aging[0].value += val; aging[0].qty += l.remaining_qty; }
    else if (days <= 60) { aging[1].value += val; aging[1].qty += l.remaining_qty; }
    else if (days <= 90) { aging[2].value += val; aging[2].qty += l.remaining_qty; }
    else { aging[3].value += val; aging[3].qty += l.remaining_qty; }
  });

  const summaryColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (s: ValuationSummary) => (
        <div>
          <p className="font-medium">{s.item_name}</p>
          <p className="text-xs text-muted-foreground">{s.item_code}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (s: ValuationSummary) => s.location_name },
    {
      key: 'qty',
      header: 'Quantity',
      render: (s: ValuationSummary) => <span className="font-medium">{s.total_qty} {s.uom}</span>,
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (s: ValuationSummary) => formatCurrency(s.unit_cost),
    },
    {
      key: 'total_value',
      header: 'Total Value',
      render: (s: ValuationSummary) => <span className="font-semibold">{formatCurrency(s.total_value)}</span>,
    },
    {
      key: 'layers',
      header: 'FIFO Layers',
      render: (s: ValuationSummary) => <Badge variant="outline">{s.layer_count}</Badge>,
    },
  ];

  // Filter FIFO layers (already sorted oldest-first by query)
  const searchLower = search.toLowerCase();
  const filteredLayers = layers.filter(l => {
    const itemName = l.items?.name || '';
    const itemCode = l.items?.code || '';
    const locName = l.locations?.name || '';
    const category = l.items?.category || 'Uncategorized';
    const matchSearch =
      itemName.toLowerCase().includes(searchLower) ||
      itemCode.toLowerCase().includes(searchLower) ||
      locName.toLowerCase().includes(searchLower);
    const matchCategory = categoryFilter === 'all' || category === categoryFilter;
    const matchLocation = locationFilter === 'all' || l.location_id === locationFilter;
    return matchSearch && matchCategory && matchLocation;
  });

  const filteredLayersQty = filteredLayers.reduce((s, l) => s + Number(l.remaining_qty), 0);
  const filteredLayersValue = filteredLayers.reduce(
    (s, l) => s + Number(l.remaining_qty) * Number(l.unit_cost),
    0
  );

  const layerColumns = [
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      render: (l: CostingLayer) => (
        <div>
          <p className="font-medium">{format(new Date(l.receipt_date), 'dd MMM yyyy')}</p>
          <p className="text-xs text-muted-foreground capitalize">{l.source_type?.replace(/_/g, ' ')}</p>
        </div>
      ),
    },
    {
      key: 'item',
      header: 'Item',
      render: (l: CostingLayer) => (
        <div>
          <p className="font-medium">{l.items?.name}</p>
          <p className="text-xs text-muted-foreground">{l.items?.code}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (l: CostingLayer) => l.locations?.name || '-' },
    {
      key: 'original_qty',
      header: 'Original Qty',
      render: (l: CostingLayer) => `${Number(l.original_qty).toLocaleString()} ${l.items?.unit_of_measure || ''}`,
    },
    {
      key: 'remaining_qty',
      header: 'Remaining Qty',
      render: (l: CostingLayer) => (
        <span className="font-medium">{Number(l.remaining_qty).toLocaleString()} {l.items?.unit_of_measure || ''}</span>
      ),
    },
    {
      key: 'unit_cost',
      header: 'Layer Unit Cost',
      render: (l: CostingLayer) => formatCurrency(Number(l.unit_cost)),
    },
    {
      key: 'remaining_value',
      header: 'Remaining Value',
      render: (l: CostingLayer) => (
        <span className="font-semibold">
          {formatCurrency(Number(l.remaining_qty) * Number(l.unit_cost))}
        </span>
      ),
    },
  ];

  // ===== Weighted Average Valuation =====
  interface WavgSummary {
    id: string;
    item_id: string;
    item_code: string;
    item_name: string;
    category: string;
    location_id: string;
    location_name: string;
    uom: string;
    total_qty: number;
    total_value: number;
    unit_cost: number;
  }
  const wavgMap = new Map<string, WavgSummary>();
  layers.forEach(l => {
    const key = `${l.item_id}-${l.location_id}`;
    const existing = wavgMap.get(key);
    const qty = Number(l.remaining_qty);
    const val = qty * Number(l.unit_cost);
    if (existing) {
      existing.total_qty += qty;
      existing.total_value += val;
    } else {
      wavgMap.set(key, {
        id: key,
        item_id: l.item_id,
        item_code: l.items?.code || '',
        item_name: l.items?.name || '',
        category: l.items?.category || 'Uncategorized',
        location_id: l.location_id,
        location_name: l.locations?.name || '',
        uom: l.items?.unit_of_measure || 'EA',
        total_qty: qty,
        total_value: val,
        unit_cost: 0,
      });
    }
  });
  const wavgSummaries = Array.from(wavgMap.values())
    .map(w => ({ ...w, unit_cost: w.total_qty > 0 ? w.total_value / w.total_qty : 0 }))
    .filter(w => {
      const matchSearch =
        w.item_name.toLowerCase().includes(searchLower) ||
        w.item_code.toLowerCase().includes(searchLower) ||
        w.location_name.toLowerCase().includes(searchLower);
      const matchCategory = categoryFilter === 'all' || w.category === categoryFilter;
      const matchLocation = locationFilter === 'all' || w.location_id === locationFilter;
      return matchSearch && matchCategory && matchLocation;
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  const wavgTotalQty = wavgSummaries.reduce((s, w) => s + w.total_qty, 0);
  const wavgTotalValue = wavgSummaries.reduce((s, w) => s + w.total_value, 0);

  const wavgColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (w: WavgSummary) => (
        <div>
          <p className="font-medium">{w.item_name}</p>
          <p className="text-xs text-muted-foreground">{w.item_code}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (w: WavgSummary) => w.location_name },
    {
      key: 'qty',
      header: 'Quantity',
      render: (w: WavgSummary) => <span className="font-medium">{w.total_qty.toLocaleString()} {w.uom}</span>,
    },
    {
      key: 'unit_cost',
      header: 'WAVG Unit Cost',
      render: (w: WavgSummary) => formatCurrency(w.unit_cost),
    },
    {
      key: 'total_value',
      header: 'Total Value',
      render: (w: WavgSummary) => <span className="font-semibold">{formatCurrency(w.total_value)}</span>,
    },
  ];

  // Running WAVG history per item+location, recalculated after each receipt
  interface WavgHistoryRow {
    id: string;
    receipt_date: string;
    item_code: string;
    item_name: string;
    location_name: string;
    uom: string;
    receipt_qty: number;
    receipt_unit_cost: number;
    running_qty: number;
    running_value: number;
    running_avg_cost: number;
  }
  const runningMap = new Map<string, { qty: number; value: number }>();
  const sortedLayers = [...layers].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  );
  const wavgHistoryAll: WavgHistoryRow[] = sortedLayers.map(l => {
    const key = `${l.item_id}-${l.location_id}`;
    const prev = runningMap.get(key) || { qty: 0, value: 0 };
    const rQty = Number(l.original_qty);
    const rCost = Number(l.unit_cost);
    const newQty = prev.qty + rQty;
    const newValue = prev.value + rQty * rCost;
    runningMap.set(key, { qty: newQty, value: newValue });
    return {
      id: l.id,
      receipt_date: l.receipt_date,
      item_code: l.items?.code || '',
      item_name: l.items?.name || '',
      location_name: l.locations?.name || '',
      uom: l.items?.unit_of_measure || 'EA',
      receipt_qty: rQty,
      receipt_unit_cost: rCost,
      running_qty: newQty,
      running_value: newValue,
      running_avg_cost: newQty > 0 ? newValue / newQty : 0,
    };
  });
  const wavgHistory = wavgHistoryAll
    .filter(r => {
      const matchSearch =
        r.item_name.toLowerCase().includes(searchLower) ||
        r.item_code.toLowerCase().includes(searchLower) ||
        r.location_name.toLowerCase().includes(searchLower);
      return matchSearch;
    })
    .reverse();

  const wavgHistoryColumns = [
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      render: (r: WavgHistoryRow) => format(new Date(r.receipt_date), 'dd MMM yyyy'),
    },
    {
      key: 'item',
      header: 'Item',
      render: (r: WavgHistoryRow) => (
        <div>
          <p className="font-medium">{r.item_name}</p>
          <p className="text-xs text-muted-foreground">{r.item_code}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (r: WavgHistoryRow) => r.location_name },
    {
      key: 'receipt_qty',
      header: 'Receipt Qty',
      render: (r: WavgHistoryRow) => `${r.receipt_qty.toLocaleString()} ${r.uom}`,
    },
    {
      key: 'receipt_unit_cost',
      header: 'Receipt Unit Cost',
      render: (r: WavgHistoryRow) => formatCurrency(r.receipt_unit_cost),
    },
    {
      key: 'running_qty',
      header: 'Running Qty',
      render: (r: WavgHistoryRow) => r.running_qty.toLocaleString(),
    },
    {
      key: 'running_avg_cost',
      header: 'Running WAVG Cost',
      render: (r: WavgHistoryRow) => <span className="font-semibold">{formatCurrency(r.running_avg_cost)}</span>,
    },
    {
      key: 'running_value',
      header: 'Running Value',
      render: (r: WavgHistoryRow) => formatCurrency(r.running_value),
    },
  ];

  // ===== Historical Valuation (as-of date) =====
  interface HistoricalRow {
    id: string;
    item_code: string;
    item_name: string;
    category: string;
    location_id: string;
    location_name: string;
    uom: string;
    quantity: number;
    avg_cost: number;
    total_value: number;
  }
  const asOfEnd = new Date(asOfDate);
  asOfEnd.setHours(23, 59, 59, 999);
  const asOfMs = asOfEnd.getTime();

  // Sum consumptions per layer up to as-of date
  const consumedByLayer = new Map<string, number>();
  consumptions.forEach(c => {
    if (new Date(c.consumed_at).getTime() <= asOfMs) {
      consumedByLayer.set(c.layer_id, (consumedByLayer.get(c.layer_id) || 0) + Number(c.quantity));
    }
  });

  const histAgg = new Map<string, HistoricalRow>();
  allLayers.forEach(l => {
    if (new Date(l.receipt_date).getTime() > asOfMs) return;
    const consumedAtDate = consumedByLayer.get(l.id) || 0;
    const remaining = Math.max(0, Number(l.original_qty) - consumedAtDate);
    if (remaining <= 0) return;
    const key = `${l.item_id}-${l.location_id}`;
    const value = remaining * Number(l.unit_cost);
    const existing = histAgg.get(key);
    if (existing) {
      existing.quantity += remaining;
      existing.total_value += value;
    } else {
      histAgg.set(key, {
        id: key,
        item_code: l.items?.code || '',
        item_name: l.items?.name || '',
        category: l.items?.category || 'Uncategorized',
        location_id: l.location_id,
        location_name: l.locations?.name || '',
        uom: l.items?.unit_of_measure || 'EA',
        quantity: remaining,
        avg_cost: 0,
        total_value: value,
      });
    }
  });
  const historicalRows = Array.from(histAgg.values())
    .map(h => ({ ...h, avg_cost: h.quantity > 0 ? h.total_value / h.quantity : 0 }))
    .filter(h => {
      const matchSearch =
        h.item_name.toLowerCase().includes(searchLower) ||
        h.item_code.toLowerCase().includes(searchLower) ||
        h.location_name.toLowerCase().includes(searchLower);
      const matchCategory = categoryFilter === 'all' || h.category === categoryFilter;
      const matchLocation = locationFilter === 'all' || h.location_id === locationFilter;
      return matchSearch && matchCategory && matchLocation;
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  const historicalQty = historicalRows.reduce((s, h) => s + h.quantity, 0);
  const historicalValue = historicalRows.reduce((s, h) => s + h.total_value, 0);

  const historicalColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (h: HistoricalRow) => (
        <div>
          <p className="font-medium">{h.item_name}</p>
          <p className="text-xs text-muted-foreground">{h.item_code}</p>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (h: HistoricalRow) => h.location_name },
    {
      key: 'qty',
      header: 'Quantity',
      render: (h: HistoricalRow) => <span className="font-medium">{h.quantity.toLocaleString()} {h.uom}</span>,
    },
    {
      key: 'avg_cost',
      header: 'Avg Unit Cost',
      render: (h: HistoricalRow) => formatCurrency(h.avg_cost),
    },
    {
      key: 'total_value',
      header: 'Total Value',
      render: (h: HistoricalRow) => <span className="font-semibold">{formatCurrency(h.total_value)}</span>,
    },
  ];



  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Inventory Valuation"
          description="FIFO-based inventory costing and valuation report"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                if (summaries.length === 0) {
                  toast.error('Nothing to export');
                  return;
                }
                const rows = summaries.map(s => ({
                  'Item Code': s.item_code,
                  'Item Name': s.item_name,
                  'Category': s.category,
                  'Location': s.location_name,
                  'Quantity': s.total_qty,
                  'UoM': s.uom,
                  'Unit Cost': Number(s.unit_cost.toFixed(2)),
                  'Total Value': Number(s.total_value.toFixed(2)),
                }));
                rows.push({
                  'Item Code': '',
                  'Item Name': 'GRAND TOTAL',
                  'Category': '',
                  'Location': '',
                  'Quantity': totalQty,
                  'UoM': '',
                  'Unit Cost': '' as any,
                  'Total Value': Number(totalInventoryValue.toFixed(2)),
                });
                exportToXLSX(rows, `inventory-valuation-${format(new Date(), 'yyyy-MM-dd')}`, 'Valuation');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Item-Locations</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Layers</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLayers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Aging 90+ Days</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(aging[3].value)}</div>
              <p className="text-xs text-muted-foreground">{aging[3].qty} units</p>
            </CardContent>
          </Card>
        </div>

        {/* Aging Breakdown */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {aging.map((bucket) => (
            <Card key={bucket.label}>
              <CardContent className="pt-4">
                <div className="text-sm font-medium text-muted-foreground">{bucket.label}</div>
                <div className="text-lg font-semibold mt-1">{formatCurrency(bucket.value)}</div>
                <div className="text-xs text-muted-foreground">{bucket.qty} units</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Valuation Table */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items or locations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <Tabs defaultValue="summary" className="w-full">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="fifo">FIFO Layers ({filteredLayers.length})</TabsTrigger>
              <TabsTrigger value="wavg">Weighted Average</TabsTrigger>
              <TabsTrigger value="gl">GL Reconciliation</TabsTrigger>
              <TabsTrigger value="historical">Historical</TabsTrigger>
            </TabsList>


            <TabsContent value="summary" className="space-y-4">
              <DataTable
                columns={summaryColumns}
                data={summaries}
                loading={loading}
                emptyMessage="No inventory on hand. Post a Goods Receipt to bring stock and cost into inventory."
              />

              {summaries.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-muted/50 rounded-md border">
                  <div className="font-semibold">Grand Total</div>
                  <div className="flex gap-8 text-sm">
                    <div>
                      <span className="text-muted-foreground mr-2">Total Quantity:</span>
                      <span className="font-semibold">{totalQty.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">Total Value:</span>
                      <span className="font-bold text-base">{formatCurrency(totalInventoryValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="fifo" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Oldest cost layers first. Remaining stock is valued at the unit cost of the layer it was received in (FIFO).
              </p>
              <DataTable
                columns={layerColumns}
                data={filteredLayers}
                loading={loading}
                emptyMessage="No active FIFO layers. Post a Goods Receipt to create cost layers."
              />
              {filteredLayers.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-muted/50 rounded-md border">
                  <div className="font-semibold">FIFO Total</div>
                  <div className="flex gap-8 text-sm">
                    <div>
                      <span className="text-muted-foreground mr-2">Remaining Qty:</span>
                      <span className="font-semibold">{filteredLayersQty.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">Remaining Value:</span>
                      <span className="font-bold text-base">{formatCurrency(filteredLayersValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="wavg" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Weighted Average Cost = Total Value / Total Quantity. Recalculated after each goods receipt.
              </p>

              <div>
                <h3 className="text-sm font-semibold mb-2">Current Weighted Average per Item & Location</h3>
                <DataTable
                  columns={wavgColumns}
                  data={wavgSummaries}
                  loading={loading}
                  emptyMessage="No inventory on hand. Post a Goods Receipt to bring stock into inventory."
                />
                {wavgSummaries.length > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 bg-muted/50 rounded-md border mt-2">
                    <div className="font-semibold">Grand Total</div>
                    <div className="flex gap-8 text-sm">
                      <div>
                        <span className="text-muted-foreground mr-2">Total Quantity:</span>
                        <span className="font-semibold">{wavgTotalQty.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground mr-2">Total Value:</span>
                        <span className="font-bold text-base">{formatCurrency(wavgTotalValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Running Weighted Average History</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Most recent receipts first. Running WAVG is recalculated after every receipt per item & location.
                </p>
                <DataTable
                  columns={wavgHistoryColumns}
                  data={wavgHistory}
                  loading={loading}
                  emptyMessage="No receipts recorded yet."
                />
              </div>
            </TabsContent>

            <TabsContent value="gl" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Inventory valuation (on-hand stock × cost) should equal the net balance of the Inventory GL account(s).
                Any difference indicates posting gaps between goods receipts/issues and the General Ledger.
              </p>
              {(() => {
                const glTotal = glInventory.reduce((s, g) => s + g.balance, 0);
                const diff = totalInventoryValue - glTotal;
                const reconciled = Math.abs(diff) < 0.01;
                return (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Inventory Valuation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatCurrency(totalInventoryValue)}</div>
                          <p className="text-xs text-muted-foreground">Stock on hand × cost</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">GL Inventory Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatCurrency(glTotal)}</div>
                          <p className="text-xs text-muted-foreground">Posted journal entries</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Difference</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${reconciled ? 'text-green-600' : 'text-destructive'}`}>
                            {formatCurrency(diff)}
                          </div>
                          <Badge variant={reconciled ? 'default' : 'destructive'} className="mt-1">
                            {reconciled ? 'Reconciled' : 'Out of balance'}
                          </Badge>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Inventory GL Accounts</h3>
                      <DataTable
                        columns={[
                          { key: 'code', header: 'Account Code', render: (g: GLAccountBalance) => g.account_code },
                          { key: 'name', header: 'Account Name', render: (g: GLAccountBalance) => g.account_name },
                          { key: 'debit', header: 'Debit', render: (g: GLAccountBalance) => formatCurrency(g.debit) },
                          { key: 'credit', header: 'Credit', render: (g: GLAccountBalance) => formatCurrency(g.credit) },
                          {
                            key: 'balance',
                            header: 'Balance',
                            render: (g: GLAccountBalance) => <span className="font-semibold">{formatCurrency(g.balance)}</span>,
                          },
                        ]}
                        data={glInventory}
                        loading={loading}
                        emptyMessage="No inventory GL accounts (account code 14xx) with posted activity."
                      />
                      {glInventory.length > 0 && (
                        <div className="flex justify-between items-center px-4 py-3 bg-muted/50 rounded-md border mt-2">
                          <div className="font-semibold">GL Total</div>
                          <div className="font-bold text-base">{formatCurrency(glTotal)}</div>
                        </div>
                      )}
                    </div>

                    {!reconciled && (
                      <Card>
                        <CardContent className="pt-4 text-sm space-y-1">
                          <p className="font-semibold">Common causes of a difference</p>
                          <ul className="list-disc pl-5 text-muted-foreground">
                            <li>Goods receipts or inventory issues left in draft (not yet posted to GL).</li>
                            <li>Manual journal entries against the inventory account outside of stock movements.</li>
                            <li>Inventory adjustments or transfers not yet posted.</li>
                            <li>Stock costed at zero (cost not captured on receipt).</li>
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="historical" className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground flex-1 min-w-[260px]">
                  Inventory value as at a past date. Reconstructed from FIFO cost layers: receipts on or before the date, minus consumptions on or before the date.
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-[240px] justify-start text-left font-normal')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      As of {format(asOfDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={asOfDate}
                      onSelect={d => d && setAsOfDate(d)}
                      disabled={d => d > new Date()}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">As-Of Date</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{format(asOfDate, 'dd MMM yyyy')}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Quantity on Hand</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{historicalQty.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Historical Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(historicalValue)}</div>
                  </CardContent>
                </Card>
              </div>

              <DataTable
                columns={historicalColumns}
                data={historicalRows}
                loading={loading}
                emptyMessage="No inventory on hand as at the selected date."
              />

              {historicalRows.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-muted/50 rounded-md border">
                  <div className="font-semibold">Total as at {format(asOfDate, 'dd MMM yyyy')}</div>
                  <div className="flex gap-8 text-sm">
                    <div>
                      <span className="text-muted-foreground mr-2">Quantity:</span>
                      <span className="font-semibold">{historicalQty.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">Value:</span>
                      <span className="font-bold text-base">{formatCurrency(historicalValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </AppLayout>
  );
}

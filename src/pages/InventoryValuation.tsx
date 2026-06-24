import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, DollarSign, Layers, Package, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function InventoryValuation() {
  const [layers, setLayers] = useState<CostingLayer[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [glInventory, setGlInventory] = useState<GLAccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');



  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [layersRes, balancesRes, glAcctsRes] = await Promise.all([
        supabase
          .from('inventory_costing_layers')
          .select('*, items(code, name, unit_of_measure, category), locations(code, name)')
          .gt('remaining_qty', 0)
          .order('receipt_date', { ascending: true }),
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
      if (balancesRes.error) throw balancesRes.error;
      if (glAcctsRes.error) throw glAcctsRes.error;
      setLayers((layersRes.data || []) as unknown as CostingLayer[]);
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

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Inventory Valuation"
          description="FIFO-based inventory costing and valuation report"
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
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

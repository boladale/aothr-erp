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
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

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
  items: { code: string; name: string; unit_of_measure: string } | null;
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

export default function InventoryValuation() {
  const [layers, setLayers] = useState<CostingLayer[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [layersRes, balancesRes] = await Promise.all([
        supabase
          .from('inventory_costing_layers')
          .select('*, items(code, name, unit_of_measure), locations(code, name)')
          .gt('remaining_qty', 0)
          .order('receipt_date', { ascending: true }),
        supabase
          .from('inventory_balances')
          .select('*, items(code, name, unit_of_measure, unit_cost), locations(code, name)')
          .gt('quantity', 0),
      ]);

      if (layersRes.error) throw layersRes.error;
      if (balancesRes.error) throw balancesRes.error;
      setLayers((layersRes.data || []) as CostingLayer[]);
      setBalances((balancesRes.data || []) as BalanceRow[]);
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
      location_name: b.locations?.name || '',
      total_qty: qty,
      unit_cost: unitCost,
      total_value: qty * unitCost,
      layer_count: agg?.count || 0,
      uom: b.items?.unit_of_measure || 'EA',
    };
  });

  const summaries = allSummaries.filter(s =>
    s.item_name.toLowerCase().includes(search.toLowerCase()) ||
    s.item_code.toLowerCase().includes(search.toLowerCase()) ||
    s.location_name.toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items or locations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

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
        </div>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

interface ValuationSummary {
  id: string;
  item_code: string;
  item_name: string;
  location_name: string;
  total_qty: number;
  total_value: number;
  weighted_avg_cost: number;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLayers();
  }, []);

  const fetchLayers = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_costing_layers')
        .select('*, items(code, name, unit_of_measure), locations(code, name)')
        .gt('remaining_qty', 0)
        .order('receipt_date', { ascending: true });

      if (error) throw error;
      setLayers((data || []) as CostingLayer[]);
    } catch (error) {
      console.error('Error fetching costing layers:', error);
      toast.error('Failed to load inventory valuation');
    } finally {
      setLoading(false);
    }
  };

  // Build valuation summary grouped by item + location
  const summaryMap = new Map<string, ValuationSummary>();
  layers.forEach(l => {
    const key = `${l.item_id}-${l.location_id}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.total_qty += l.remaining_qty;
      existing.total_value += l.remaining_qty * l.unit_cost;
      existing.layer_count += 1;
      existing.weighted_avg_cost = existing.total_value / existing.total_qty;
    } else {
      summaryMap.set(key, {
        id: key,
        item_code: l.items?.code || '',
        item_name: l.items?.name || '',
        location_name: l.locations?.name || '',
        total_qty: l.remaining_qty,
        total_value: l.remaining_qty * l.unit_cost,
        weighted_avg_cost: l.unit_cost,
        layer_count: 1,
        uom: l.items?.unit_of_measure || 'EA',
      });
    }
  });

  const summaries = Array.from(summaryMap.values()).filter(s =>
    s.item_name.toLowerCase().includes(search.toLowerCase()) ||
    s.item_code.toLowerCase().includes(search.toLowerCase()) ||
    s.location_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalInventoryValue = summaries.reduce((sum, s) => sum + s.total_value, 0);
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
      key: 'avg_cost',
      header: 'Wtd. Avg Cost',
      render: (s: ValuationSummary) => formatCurrency(s.weighted_avg_cost),
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
            emptyMessage="No inventory costing layers found. Layers are created when goods receipts are posted."
          />
        </div>
      </div>
    </AppLayout>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/ui/export-button';
import { format } from 'date-fns';

type MovementType = 'GRN' | 'Issue' | 'Transfer In' | 'Transfer Out' | 'Delivery' | 'Adjustment';

interface Movement {
  id: string;
  date: string;
  type: MovementType;
  reference: string;
  item_id: string;
  item_code: string;
  item_name: string;
  location_id: string;
  location_name: string;
  qty_in: number;
  qty_out: number;
  user?: string | null;
}

export default function StockMovements() {
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const itemsQ = useQuery({
    queryKey: ['items-min-mv'],
    queryFn: async () => {
      const { data } = await supabase.from('items').select('id, code, name').order('name');
      return data || [];
    },
  });
  const locationsQ = useQuery({
    queryKey: ['locations-min-mv'],
    queryFn: async () => {
      const { data } = await supabase.from('locations').select('id, code, name').order('name');
      return data || [];
    },
  });

  const movementsQ = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async (): Promise<Movement[]> => {
      const movements: Movement[] = [];

      // GRN receipts
      const { data: grnLines } = await supabase
        .from('goods_receipt_lines')
        .select('id, qty_received, item_id, items(code, name), goods_receipts!inner(grn_number, receipt_date, status, location_id, locations(name), posted_by)')
        .eq('goods_receipts.status', 'posted');
      (grnLines || []).forEach((l: any) => {
        movements.push({
          id: `grn-${l.id}`,
          date: l.goods_receipts.receipt_date,
          type: 'GRN',
          reference: l.goods_receipts.grn_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: l.goods_receipts.location_id,
          location_name: l.goods_receipts.locations?.name || '',
          qty_in: Number(l.qty_received) || 0,
          qty_out: 0,
        });
      });

      // Inventory Issues
      const { data: issueLines } = await supabase
        .from('inventory_issue_lines')
        .select('id, quantity, item_id, items(code, name), inventory_issues!inner(issue_number, issue_date, status, location_id, locations(name))')
        .eq('inventory_issues.status', 'posted');
      (issueLines || []).forEach((l: any) => {
        movements.push({
          id: `iss-${l.id}`,
          date: l.inventory_issues.issue_date,
          type: 'Issue',
          reference: l.inventory_issues.issue_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: l.inventory_issues.location_id,
          location_name: l.inventory_issues.locations?.name || '',
          qty_in: 0,
          qty_out: Number(l.quantity) || 0,
        });
      });

      // Transfers (in + out)
      const { data: trLines } = await supabase
        .from('inventory_transfer_lines')
        .select('id, quantity, item_id, items(code, name), inventory_transfers!inner(transfer_number, transfer_date, status, from_location_id, to_location_id, from_loc:locations!inventory_transfers_from_location_id_fkey(name), to_loc:locations!inventory_transfers_to_location_id_fkey(name))')
        .eq('inventory_transfers.status', 'posted');
      (trLines || []).forEach((l: any) => {
        const t = l.inventory_transfers;
        movements.push({
          id: `tr-out-${l.id}`,
          date: t.transfer_date,
          type: 'Transfer Out',
          reference: t.transfer_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: t.from_location_id,
          location_name: t.from_loc?.name || '',
          qty_in: 0,
          qty_out: Number(l.quantity) || 0,
        });
        movements.push({
          id: `tr-in-${l.id}`,
          date: t.transfer_date,
          type: 'Transfer In',
          reference: t.transfer_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: t.to_location_id,
          location_name: t.to_loc?.name || '',
          qty_in: Number(l.quantity) || 0,
          qty_out: 0,
        });
      });

      // Delivery Notes
      const { data: dnLines } = await supabase
        .from('delivery_note_lines')
        .select('id, quantity, item_id, items(code, name), delivery_notes!inner(dn_number, delivery_date, status, location_id, locations(name))')
        .eq('delivery_notes.status', 'posted');
      (dnLines || []).forEach((l: any) => {
        movements.push({
          id: `dn-${l.id}`,
          date: l.delivery_notes.delivery_date,
          type: 'Delivery',
          reference: l.delivery_notes.dn_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: l.delivery_notes.location_id,
          location_name: l.delivery_notes.locations?.name || '',
          qty_in: 0,
          qty_out: Number(l.quantity) || 0,
        });
      });

      // Adjustments
      const { data: adjLines } = await supabase
        .from('inventory_adjustment_lines')
        .select('id, quantity, adjustment_type, item_id, items(code, name), inventory_adjustments!inner(adjustment_number, status, location_id, posted_at, locations(name))')
        .eq('inventory_adjustments.status', 'posted');
      (adjLines || []).forEach((l: any) => {
        const isIncrease = l.adjustment_type === 'increase';
        movements.push({
          id: `adj-${l.id}`,
          date: l.inventory_adjustments.posted_at?.split('T')[0] || '',
          type: 'Adjustment',
          reference: l.inventory_adjustments.adjustment_number,
          item_id: l.item_id,
          item_code: l.items?.code || '',
          item_name: l.items?.name || '',
          location_id: l.inventory_adjustments.location_id,
          location_name: l.inventory_adjustments.locations?.name || '',
          qty_in: isIncrease ? Number(l.quantity) || 0 : 0,
          qty_out: isIncrease ? 0 : Number(l.quantity) || 0,
        });
      });

      return movements.sort((a, b) => (a.date < b.date ? 1 : -1));
    },
  });

  const movements = movementsQ.data || [];

  const filtered = useMemo(() => {
    let list = movements;
    if (itemFilter !== 'all') list = list.filter(m => m.item_id === itemFilter);
    if (locationFilter !== 'all') list = list.filter(m => m.location_id === locationFilter);
    if (typeFilter !== 'all') list = list.filter(m => m.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.reference.toLowerCase().includes(q) ||
        m.item_code.toLowerCase().includes(q) ||
        m.item_name.toLowerCase().includes(q) ||
        m.location_name.toLowerCase().includes(q)
      );
    }
    // Running balance per item+location (only when filtered to a single combo)
    if (itemFilter !== 'all' && locationFilter !== 'all') {
      const chronological = [...list].sort((a, b) => (a.date > b.date ? 1 : -1));
      let bal = 0;
      const withBal = chronological.map(m => {
        bal += m.qty_in - m.qty_out;
        return { ...m, balance: bal } as Movement & { balance: number };
      });
      return withBal.reverse();
    }
    return list as (Movement & { balance?: number })[];
  }, [movements, itemFilter, locationFilter, typeFilter, search]);

  const typeColor: Record<MovementType, string> = {
    'GRN': 'bg-green-100 text-green-800',
    'Issue': 'bg-orange-100 text-orange-800',
    'Transfer In': 'bg-blue-100 text-blue-800',
    'Transfer Out': 'bg-amber-100 text-amber-800',
    'Delivery': 'bg-purple-100 text-purple-800',
    'Adjustment': 'bg-slate-100 text-slate-800',
  };

  const showBalance = itemFilter !== 'all' && locationFilter !== 'all';

  const columns: any[] = [
    { key: 'date', header: 'Date', render: (m: Movement) => m.date ? format(new Date(m.date), 'dd MMM yyyy') : '-' },
    { key: 'type', header: 'Type', render: (m: Movement) => <Badge className={typeColor[m.type]} variant="secondary">{m.type}</Badge> },
    { key: 'reference', header: 'Reference', render: (m: Movement) => <span className="font-medium">{m.reference}</span> },
    { key: 'item', header: 'Item', render: (m: Movement) => <div><p className="font-medium">{m.item_name}</p><p className="text-xs text-muted-foreground">{m.item_code}</p></div> },
    { key: 'location', header: 'Location', render: (m: Movement) => m.location_name },
    { key: 'qty_in', header: 'Qty In', render: (m: Movement) => m.qty_in > 0 ? <span className="text-green-700 font-medium">+{m.qty_in}</span> : '-' },
    { key: 'qty_out', header: 'Qty Out', render: (m: Movement) => m.qty_out > 0 ? <span className="text-orange-700 font-medium">-{m.qty_out}</span> : '-' },
  ];
  if (showBalance) {
    columns.push({ key: 'balance', header: 'Balance', render: (m: any) => <span className="font-semibold">{m.balance}</span> });
  }

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Stock Movement History"
          description="Unified history of all inventory movements: receipts, issues, transfers, deliveries, and adjustments."
          icon={History}
        />

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ref / item / location..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={itemFilter} onValueChange={setItemFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Items" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              {(itemsQ.data || []).map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(locationsQ.data || []).map((l: any) => (
                <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="GRN">GRN</SelectItem>
              <SelectItem value="Issue">Issue</SelectItem>
              <SelectItem value="Transfer In">Transfer In</SelectItem>
              <SelectItem value="Transfer Out">Transfer Out</SelectItem>
              <SelectItem value="Delivery">Delivery</SelectItem>
              <SelectItem value="Adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ExportButton
              filename="stock-movements"
              sheetName="Movements"
              rows={filtered.map(m => ({
                Date: m.date, Type: m.type, Reference: m.reference,
                'Item Code': m.item_code, 'Item Name': m.item_name,
                Location: m.location_name, 'Qty In': m.qty_in, 'Qty Out': m.qty_out,
                ...(showBalance ? { Balance: (m as any).balance } : {}),
              }))}
            />
          </div>
        </div>

        {!showBalance && (
          <p className="text-xs text-muted-foreground mb-2">Tip: select a specific item <em>and</em> location to see a running balance.</p>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          loading={movementsQ.isLoading}
          emptyMessage="No stock movements found."
        />
      </div>
    </AppLayout>
  );
}

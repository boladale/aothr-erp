import { useState, useMemo } from 'react';
import { Plus, Search, ArrowRightLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Location, Item } from '@/lib/supabase';

interface TransferRow {
  id: string;
  transfer_number: string;
  from_location_id: string;
  to_location_id: string;
  transfer_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  from_location: Location | null;
  to_location: Location | null;
}

interface TransferLine {
  item_id: string;
  quantity: number;
}

export default function InventoryTransfers() {
  const { user, organizationId, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApproveSource = hasRole('admin') || hasRole('warehouse_manager');
  const canApproveDest = hasRole('admin') || hasRole('warehouse_manager');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', transfer_date: new Date().toISOString().split('T')[0], notes: '' });
  const [lines, setLines] = useState<TransferLine[]>([{ item_id: '', quantity: 1 }]);

  const transfersQ = useQuery({
    queryKey: ['inventory_transfers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_transfers' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const locationsQ = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as Location[];
    },
  });
  const itemsQ = useQuery({
    queryKey: ['items', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as Item[];
    },
  });
  // Live source-warehouse balances for stock-availability validation
  const balancesQ = useQuery({
    queryKey: ['inventory_balances', form.from_location_id],
    enabled: !!form.from_location_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_balances')
        .select('item_id, quantity').eq('location_id', form.from_location_id);
      if (error) throw error;
      return (data || []) as { item_id: string; quantity: number }[];
    },
  });

  const locations = locationsQ.data || [];
  const items = itemsQ.data || [];
  const loading = transfersQ.isLoading;

  const transfers: TransferRow[] = useMemo(() => {
    const locMap = new Map(locations.map(l => [l.id, l]));
    return (transfersQ.data || []).map((t: any) => ({
      ...t,
      from_location: locMap.get(t.from_location_id) || null,
      to_location: locMap.get(t.to_location_id) || null,
    }));
  }, [transfersQ.data, locations]);

  const balanceMap = useMemo(() => new Map((balancesQ.data || []).map(b => [b.item_id, Number(b.quantity)])), [balancesQ.data]);
  const availableFor = (itemId: string) => balanceMap.get(itemId) ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory_transfers'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.from_location_id || !form.to_location_id) throw new Error('Select both locations');
      if (form.from_location_id === form.to_location_id) throw new Error('Source and destination must be different');
      const validLines = lines.filter(l => l.item_id && l.quantity > 0);
      if (validLines.length === 0) throw new Error('Add at least one item');

      // Stock availability guard — surfaces friendly error before the DB trigger fires
      const insufficient = validLines.find(l => l.quantity > availableFor(l.item_id));
      if (insufficient) {
        const item = items.find(i => i.id === insufficient.item_id);
        throw new Error(`Insufficient stock for ${item?.name || 'item'}: requested ${insufficient.quantity}, available ${availableFor(insufficient.item_id)}`);
      }

      const num = await getNextTransactionNumber(organizationId!, 'TRF', 'TRF');
      const { data: transfer, error } = await (supabase.from('inventory_transfers' as any) as any).insert({
        transfer_number: num, from_location_id: form.from_location_id, to_location_id: form.to_location_id,
        transfer_date: form.transfer_date, notes: form.notes || null, created_by: user?.id, organization_id: organizationId,
      }).select().single();
      if (error) throw error;

      const lineInserts = validLines.map((l, idx) => ({
        transfer_id: transfer.id, item_id: l.item_id, quantity: l.quantity, line_number: idx + 1,
      }));
      const { error: lErr } = await (supabase.from('inventory_transfer_lines' as any) as any).insert(lineInserts);
      if (lErr) {
        await (supabase.from('inventory_transfers' as any) as any).delete().eq('id', transfer.id);
        throw lErr;
      }
    },
    onSuccess: () => {
      toast.success('Transfer created. Submit for source-warehouse approval.');
      setDialogOpen(false);
      resetForm();
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create transfer'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase.from('inventory_transfers' as any) as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success((vars as any).successMessage || 'Updated');
      invalidate();
      qc.invalidateQueries({ queryKey: ['inventory_balances'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Action failed'),
  });
  const postingId = updateStatusMutation.isPending ? (updateStatusMutation.variables as any)?.id ?? null : null;
  const runStatus = (id: string, patch: Record<string, any>, successMessage: string) =>
    updateStatusMutation.mutate({ id, patch, successMessage } as any);

  const handleSubmit = (t: TransferRow) => runStatus(t.id, { status: 'pending_source_approval' }, 'Submitted for source approval');
  const handleApproveSource = (t: TransferRow) => runStatus(t.id, { status: 'in_transit', source_approved_by: user?.id, source_approved_at: new Date().toISOString() }, 'Approved at source. Stock dispatched.');
  const handleApproveDest = (t: TransferRow) => runStatus(t.id, { status: 'received', destination_approved_by: user?.id, destination_approved_at: new Date().toISOString() }, 'Received at destination. Stock added.');
  const handleReject = (t: TransferRow) => {
    const reason = prompt('Reason for rejection?');
    if (!reason) return;
    runStatus(t.id, { status: 'rejected', rejection_reason: reason }, 'Transfer rejected');
  };

  const resetForm = () => {
    setForm({ from_location_id: '', to_location_id: '', transfer_date: new Date().toISOString().split('T')[0], notes: '' });
    setLines([{ item_id: '', quantity: 1 }]);
  };

  const filtered = transfers.filter(t =>
    t.transfer_number.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'transfer_number', header: 'Transfer #', render: (r: TransferRow) => <span className="font-medium">{r.transfer_number}</span> },
    { key: 'from', header: 'From', render: (r: TransferRow) => r.from_location?.name || '-' },
    { key: 'to', header: 'To', render: (r: TransferRow) => r.to_location?.name || '-' },
    { key: 'date', header: 'Date', render: (r: TransferRow) => new Date(r.transfer_date).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r: TransferRow) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '',
      render: (r: TransferRow) => {
        const busy = postingId === r.id;
        const stop = (e: React.MouseEvent) => e.stopPropagation();
        if (r.status === 'draft') return (
          <div className="flex gap-1" onClick={stop}>
            <Button size="sm" disabled={busy} onClick={() => handleSubmit(r)}>{busy ? '...' : 'Submit'}</Button>
          </div>
        );
        if (r.status === 'pending_source_approval' && canApproveSource) return (
          <div className="flex gap-1" onClick={stop}>
            <Button size="sm" disabled={busy} onClick={() => handleApproveSource(r)}>Approve (Source)</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReject(r)}>Reject</Button>
          </div>
        );
        if (r.status === 'in_transit' && canApproveDest) return (
          <div className="flex gap-1" onClick={stop}>
            <Button size="sm" disabled={busy} onClick={() => handleApproveDest(r)}>Approve (Destination)</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => handleReject(r)}>Reject</Button>
          </div>
        );
        return null;
      }
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Inventory Transfers" description="Transfer items between warehouses"
          actions={<Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>} />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search transfers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No transfers found." />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> New Inventory Transfer</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Warehouse *</Label>
                  <Select value={form.from_location_id} onValueChange={v => setForm({ ...form, from_location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Warehouse *</Label>
                  <Select value={form.to_location_id} onValueChange={v => setForm({ ...form, to_location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>{locations.filter(l => l.id !== form.from_location_id).map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Transfer Date</Label>
                <Input type="date" value={form.transfer_date} onChange={e => setForm({ ...form, transfer_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items {form.from_location_id && <span className="text-xs text-muted-foreground font-normal">(showing available qty at source)</span>}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { item_id: '', quantity: 1 }])}>Add Item</Button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const hasSource = !!form.from_location_id;
                    const avail = line.item_id && hasSource ? availableFor(line.item_id) : null;
                    const noStock = avail !== null && avail <= 0;
                    const overLimit = avail !== null && line.quantity > avail;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Select value={line.item_id} onValueChange={v => { const nl = [...lines]; nl[idx].item_id = v; setLines(nl); }}>
                              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                              <SelectContent>
                                {items.map(item => {
                                  const stock = hasSource ? availableFor(item.id) : null;
                                  return (
                                    <SelectItem key={item.id} value={item.id} disabled={stock !== null && stock <= 0}>
                                      {item.code} - {item.name}{stock !== null ? ` (${stock} available)` : ''}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24">
                            <Input type="number" min="1" placeholder="Qty" value={line.quantity}
                              disabled={noStock}
                              onChange={e => { const nl = [...lines]; nl[idx].quantity = parseFloat(e.target.value) || 0; setLines(nl); }} />
                          </div>
                          {lines.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>×</Button>}
                        </div>
                        {line.item_id && hasSource && !noStock && !overLimit && (
                          <p className="text-xs text-muted-foreground">Available at source: {avail} units</p>
                        )}
                        {noStock && (
                          <p className="text-xs text-destructive">No stock available at this location</p>
                        )}
                        {overLimit && (
                          <p className="text-xs text-destructive">Insufficient stock. Only {avail} units available at this location.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  !form.from_location_id ||
                  lines.some(l => l.item_id && form.from_location_id && l.quantity > availableFor(l.item_id))
                }
              >
                {saveMutation.isPending ? 'Saving...' : 'Create Transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

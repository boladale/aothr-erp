import { useEffect, useState } from 'react';
import { Plus, Search, ArrowRightLeft } from 'lucide-react';
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
  item_name?: string;
  available?: number;
}

export default function InventoryTransfers() {
  const { user, organizationId } = useAuth();
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [form, setForm] = useState({ from_location_id: '', to_location_id: '', transfer_date: new Date().toISOString().split('T')[0], notes: '' });
  const [lines, setLines] = useState<TransferLine[]>([{ item_id: '', quantity: 1 }]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tRes, lRes, iRes] = await Promise.all([
        supabase.from('inventory_transfers' as any).select('*, from_location:locations!inventory_transfers_from_location_id_fkey(*), to_location:locations!inventory_transfers_to_location_id_fkey(*)').order('created_at', { ascending: false }),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
        supabase.from('items').select('*').eq('is_active', true).order('name'),
      ]);
      setTransfers((tRes.data || []) as TransferRow[]);
      setLocations((lRes.data || []) as Location[]);
      setItems((iRes.data || []) as Item[]);
    } catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.from_location_id || !form.to_location_id) { toast.error('Select both locations'); return; }
    if (form.from_location_id === form.to_location_id) { toast.error('Source and destination must be different'); return; }
    const validLines = lines.filter(l => l.item_id && l.quantity > 0);
    if (validLines.length === 0) { toast.error('Add at least one item'); return; }

    setSaving(true);
    try {
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
      if (lErr) throw lErr;

      toast.success('Transfer created. Post to move inventory.');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to create transfer'); } finally { setSaving(false); }
  };

  const handlePost = async (t: TransferRow) => {
    if (postingId) return;
    setPostingId(t.id);
    try {
      const { error } = await (supabase.from('inventory_transfers' as any) as any).update({ status: 'posted' }).eq('id', t.id);
      if (error) throw error;
      toast.success('Transfer posted. Inventory moved.');
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to post'); } finally { setPostingId(null); }
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
      render: (r: TransferRow) => r.status === 'draft' ? (
        <Button size="sm" variant="default" disabled={postingId === r.id} onClick={(e) => { e.stopPropagation(); handlePost(r); }}>
          {postingId === r.id ? 'Posting...' : 'Post'}
        </Button>
      ) : null
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
                <div className="flex items-center justify-between"><Label>Items</Label><Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { item_id: '', quantity: 1 }])}>Add Item</Button></div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={line.item_id} onValueChange={v => { const nl = [...lines]; nl[idx].item_id = v; setLines(nl); }}>
                          <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Input type="number" min="1" placeholder="Qty" value={line.quantity} onChange={e => { const nl = [...lines]; nl[idx].quantity = parseFloat(e.target.value) || 0; setLines(nl); }} />
                      </div>
                      {lines.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>×</Button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Transfer'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

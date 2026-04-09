import { useEffect, useState } from 'react';
import { Plus, Search, Truck, Pencil } from 'lucide-react';
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
import type { GoodsReceipt, PurchaseOrder, Location, PurchaseOrderLine, Item } from '@/lib/supabase';

interface GRNWithDetails extends GoodsReceipt {
  purchase_orders: { po_number: string; vendors: { name: string } | null } | null;
  locations: Location | null;
}
interface POWithVendor extends PurchaseOrder { vendors: { name: string } | null; }
interface POLineWithItem extends PurchaseOrderLine { items: Item | null; }
interface GRNLine { po_line_id: string; item_id: string; qty_received: number; max_receivable: number; item_name: string; }

export default function GoodsReceipts() {
  const { user, organizationId } = useAuth();
  const [receipts, setReceipts] = useState<GRNWithDetails[]>([]);
  const [openPOs, setOpenPOs] = useState<POWithVendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [editingGRN, setEditingGRN] = useState<GRNWithDetails | null>(null);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [form, setForm] = useState({ location_id: '', receipt_date: new Date().toISOString().split('T')[0], notes: '', weigh_bill_number: '' });
  const [lines, setLines] = useState<GRNLine[]>([]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedPO && !editingGRN) fetchPOLines(selectedPO); }, [selectedPO]);

  const fetchData = async () => {
    try {
      const [receiptsRes, posRes, locationsRes] = await Promise.all([
        supabase.from('goods_receipts').select('*, purchase_orders(po_number, vendors(name)), locations(*)').order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('*, vendors(name)').in('status', ['sent', 'partially_received']).order('po_number'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
      ]);
      setReceipts((receiptsRes.data || []) as GRNWithDetails[]);
      setOpenPOs((posRes.data || []) as POWithVendor[]);
      setLocations((locationsRes.data || []) as Location[]);
    } catch { toast.error('Failed to load data'); } finally { setLoading(false); }
  };

  const fetchPOLines = async (poId: string) => {
    const { data } = await supabase.from('purchase_order_lines').select('*, items(*)').eq('po_id', poId).order('line_number');
    const poLinesData = (data || []) as POLineWithItem[];
    setLines(poLinesData.map(pl => ({
      po_line_id: pl.id, item_id: pl.item_id, qty_received: 0,
      max_receivable: pl.quantity - pl.qty_received, item_name: pl.items?.name || '',
    })));
  };

  const openEditDialog = async (grn: GRNWithDetails) => {
    setEditingGRN(grn);
    setSelectedPO(grn.po_id);
    setForm({ location_id: grn.location_id, receipt_date: grn.receipt_date, notes: grn.notes || '', weigh_bill_number: (grn as any).weigh_bill_number || '' });
    // Load existing GRN lines
    const { data: grnLines } = await supabase.from('goods_receipt_lines').select('*, items(name)').eq('grn_id', grn.id);
    // Load PO lines for max info
    const { data: poLines } = await supabase.from('purchase_order_lines').select('*, items(*)').eq('po_id', grn.po_id).order('line_number');
    const poLineMap = new Map((poLines || []).map((pl: any) => [pl.id, pl]));
    setLines((grnLines || []).map((gl: any) => {
      const pol = poLineMap.get(gl.po_line_id) as any;
      return {
        po_line_id: gl.po_line_id, item_id: gl.item_id, qty_received: gl.qty_received,
        max_receivable: pol ? pol.quantity - pol.qty_received + gl.qty_received : gl.qty_received,
        item_name: gl.items?.name || pol?.items?.name || '',
      };
    }));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPO || !form.location_id) { toast.error('Please select a PO and location'); return; }
    if (!form.weigh_bill_number.trim()) { toast.error('Weigh bill number is mandatory'); return; }
    const validLines = lines.filter(l => l.qty_received > 0);
    if (validLines.length === 0) { toast.error('Please enter at least one quantity'); return; }
    const overReceipt = validLines.find(l => l.qty_received > l.max_receivable);
    if (overReceipt) { toast.error(`Cannot receive more than ordered for ${overReceipt.item_name}`); return; }

    setSaving(true);
    try {
      if (editingGRN) {
        const { error } = await supabase.from('goods_receipts').update({
          location_id: form.location_id, receipt_date: form.receipt_date, notes: form.notes, weigh_bill_number: form.weigh_bill_number,
        }).eq('id', editingGRN.id);
        if (error) throw error;
        await supabase.from('goods_receipt_lines').delete().eq('grn_id', editingGRN.id);
        await supabase.from('goods_receipt_lines').insert(validLines.map(l => ({
          grn_id: editingGRN.id, po_line_id: l.po_line_id, item_id: l.item_id, qty_received: l.qty_received,
        })));
        toast.success('Goods Receipt updated');
      } else {
        const grnNumber = await getNextTransactionNumber(organizationId!, 'GRN', 'GRN');
        const { data: grn, error } = await supabase.from('goods_receipts').insert({
          grn_number: grnNumber, po_id: selectedPO, location_id: form.location_id,
          receipt_date: form.receipt_date, notes: form.notes, weigh_bill_number: form.weigh_bill_number, created_by: user?.id, organization_id: organizationId,
        }).select().single();
        if (error) throw error;
        await supabase.from('goods_receipt_lines').insert(validLines.map(l => ({
          grn_id: grn.id, po_line_id: l.po_line_id, item_id: l.item_id, qty_received: l.qty_received,
        })));
        toast.success('Goods Receipt created. Post it to update inventory.');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save GRN');
    } finally { setSaving(false); }
  };

  const handlePost = async (grn: GRNWithDetails) => {
    if (postingId) return;
    setPostingId(grn.id);
    try {
      const { error } = await supabase.from('goods_receipts').update({
        status: 'posted', posted_at: new Date().toISOString(), posted_by: user?.id,
      }).eq('id', grn.id);
      if (error) throw error;
      toast.success('GRN posted and inventory updated');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to post GRN');
    } finally { setPostingId(null); }
  };

  const resetForm = () => {
    setEditingGRN(null); setSelectedPO(''); setLines([]);
    setForm({ location_id: '', receipt_date: new Date().toISOString().split('T')[0], notes: '', weigh_bill_number: '' });
  };

  const updateLineQty = (idx: number, qty: number) => {
    const newLines = [...lines];
    newLines[idx].qty_received = Math.min(Math.max(0, qty), newLines[idx].max_receivable);
    setLines(newLines);
  };

  const filtered = receipts.filter(r =>
    r.grn_number.toLowerCase().includes(search.toLowerCase()) ||
    r.purchase_orders?.po_number?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'grn_number', header: 'GRN Number', render: (r: GRNWithDetails) => <span className="font-medium">{r.grn_number}</span> },
    { key: 'po', header: 'PO', render: (r: GRNWithDetails) => r.purchase_orders?.po_number || '-' },
    { key: 'vendor', header: 'Vendor', render: (r: GRNWithDetails) => r.purchase_orders?.vendors?.name || '-' },
    { key: 'location', header: 'Location', render: (r: GRNWithDetails) => r.locations?.name || '-' },
    { key: 'receipt_date', header: 'Date', render: (r: GRNWithDetails) => new Date(r.receipt_date).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r: GRNWithDetails) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '',
      render: (r: GRNWithDetails) => (
        <div className="flex gap-2 justify-end">
          {r.status === 'draft' && (
            <>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditDialog(r); }}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="default" disabled={postingId === r.id} onClick={(e) => { e.stopPropagation(); handlePost(r); }}>
                {postingId === r.id ? 'Posting...' : 'Post'}
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Goods Receipts" description="Receive goods against purchase orders"
          actions={<Button onClick={() => { resetForm(); setDialogOpen(true); }} disabled={loading}><Plus className="mr-2 h-4 w-4" /> Create GRN</Button>} />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search GRNs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No goods receipts found." />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> {editingGRN ? 'Edit Goods Receipt' : 'New Goods Receipt'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Order *</Label>
                  {editingGRN ? (
                    <Input value={editingGRN.purchase_orders?.po_number || ''} disabled />
                  ) : (
                    <Select value={selectedPO} onValueChange={setSelectedPO}>
                      <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                      <SelectContent>{openPOs.map(po => <SelectItem key={po.id} value={po.id}>{po.po_number} - {po.vendors?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Receipt Date</Label>
                <Input type="date" value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} />
              </div>
              {lines.length > 0 && (
                <div className="space-y-2">
                  <Label>Items to Receive</Label>
                  <div className="border rounded-lg divide-y">
                    {lines.map((line, idx) => (
                      <div key={line.po_line_id} className="p-3 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{line.item_name}</p>
                          <p className="text-xs text-muted-foreground">Max receivable: {line.max_receivable}</p>
                        </div>
                        <Input type="number" min="0" max={line.max_receivable} className="w-28" value={line.qty_received}
                          onChange={e => updateLineQty(idx, parseFloat(e.target.value) || 0)} placeholder="0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weigh Bill Number *</Label>
                  <Input value={form.weigh_bill_number} onChange={e => setForm({ ...form, weigh_bill_number: e.target.value })} placeholder="Enter weigh bill number" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingGRN ? 'Update GRN' : 'Create GRN'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { PurchaseOrder, Vendor, Location, Item, POStatus } from '@/lib/supabase';

interface POWithDetails extends PurchaseOrder {
  vendors: Vendor | null;
  locations: Location | null;
}

interface POLine {
  item_id: string;
  quantity: number;
  unit_price: number;
}

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { user, hasRole, organizationId } = useAuth();
  const canApprove = hasRole('admin') || hasRole('procurement_manager');
  const canSend = canApprove || hasRole('procurement_officer');
  const canInitiate = !!user;
  const [orders, setOrders] = useState<POWithDetails[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPO, setEditingPO] = useState<POWithDetails | null>(null);
  const [form, setForm] = useState({
    vendor_id: '',
    ship_to_location_id: '',
    expected_date: '',
    notes: '',
  });
  const [lines, setLines] = useState<POLine[]>([{ item_id: '', quantity: 1, unit_price: 0 }]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, vendorsRes, locationsRes, itemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, vendors(*), locations(*)').order('created_at', { ascending: false }),
        supabase.from('vendors').select('*').eq('status', 'active').order('name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
        supabase.from('items').select('*').eq('is_active', true).order('name'),
      ]);
      setOrders((ordersRes.data || []) as POWithDetails[]);
      setVendors((vendorsRes.data || []) as Vendor[]);
      setLocations((locationsRes.data || []) as Location[]);
      setItems((itemsRes.data || []) as Item[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = async (po: POWithDetails) => {
    setEditingPO(po);
    setForm({
      vendor_id: po.vendor_id,
      ship_to_location_id: po.ship_to_location_id || '',
      expected_date: po.expected_date || '',
      notes: po.notes || '',
    });
    const { data } = await supabase.from('purchase_order_lines').select('*').eq('po_id', po.id).order('line_number');
    setLines((data || []).map((l: any) => ({ item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.vendor_id) { toast.error('Please select a vendor'); return; }
    const validLines = lines.filter(l => l.item_id && l.quantity > 0);
    if (validLines.length === 0) { toast.error('Please add at least one line item'); return; }

    setSaving(true);
    try {
      const subtotal = validLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);

      if (editingPO) {
        // Update existing draft PO
        const { error: poError } = await supabase.from('purchase_orders').update({
          vendor_id: form.vendor_id,
          ship_to_location_id: form.ship_to_location_id || null,
          expected_date: form.expected_date || null,
          notes: form.notes,
          subtotal,
          total_amount: subtotal,
        }).eq('id', editingPO.id);
        if (poError) throw poError;

        // Replace lines
        await supabase.from('purchase_order_lines').delete().eq('po_id', editingPO.id);
        const lineInserts = validLines.map((l, idx) => ({
          po_id: editingPO.id, line_number: idx + 1, item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price,
        }));
        const { error: linesError } = await supabase.from('purchase_order_lines').insert(lineInserts);
        if (linesError) throw linesError;
        toast.success('Purchase Order updated');
      } else {
        // Create new
        const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
        const { data: po, error: poError } = await supabase.from('purchase_orders').insert({
          po_number: poNumber, vendor_id: form.vendor_id, ship_to_location_id: form.ship_to_location_id || null,
          expected_date: form.expected_date || null, notes: form.notes, subtotal, total_amount: subtotal,
          created_by: user?.id, organization_id: organizationId,
        }).select().single();
        if (poError) throw poError;
        const lineInserts = validLines.map((l, idx) => ({
          po_id: po.id, line_number: idx + 1, item_id: l.item_id, quantity: l.quantity, unit_price: l.unit_price,
        }));
        const { error: linesError } = await supabase.from('purchase_order_lines').insert(lineInserts);
        if (linesError) throw linesError;
        toast.success('Purchase Order created');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save PO');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingPO(null);
    setForm({ vendor_id: '', ship_to_location_id: '', expected_date: '', notes: '' });
    setLines([{ item_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleSubmit = async (po: POWithDetails) => {
    try {
      const { error } = await supabase.from('purchase_orders').update({ status: 'pending_approval' as POStatus, rejection_reason: null }).eq('id', po.id);
      if (error) throw error;
      toast.success('Submitted for approval');
      fetchData();
    } catch { toast.error('Failed to submit'); }
  };

  const handleApprove = async (po: POWithDetails) => {
    try {
      const { error: poError } = await supabase.from('purchase_orders').update({
        status: 'approved' as POStatus, approved_by: user?.id, approved_at: new Date().toISOString(),
      }).eq('id', po.id);
      if (poError) throw poError;
      await supabase.from('po_approvals').insert({ po_id: po.id, approved_by: user?.id, approved_at: new Date().toISOString() });
      toast.success('PO approved');
      fetchData();
    } catch { toast.error('Failed to approve'); }
  };

  const handleRejectPO = async (po: POWithDetails) => {
    const reason = window.prompt('Please enter a reason for rejection:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('A rejection reason is required'); return; }
    try {
      const { error } = await supabase.from('purchase_orders').update({ status: 'draft' as POStatus, rejection_reason: reason }).eq('id', po.id);
      if (error) throw error;
      toast.success('PO returned to draft for corrections');
      fetchData();
    } catch { toast.error('Failed to reject PO'); }
  };

  const handleSend = async (po: POWithDetails) => {
    try {
      const { error } = await supabase.from('purchase_orders').update({ status: 'sent' as POStatus, sent_at: new Date().toISOString() }).eq('id', po.id);
      if (error) throw error;
      toast.success('PO marked as sent');
      fetchData();
    } catch { toast.error('Failed to send'); }
  };

  const addLine = () => setLines([...lines, { item_id: '', quantity: 1, unit_price: 0 }]);

  const updateLine = (idx: number, field: keyof POLine, value: string | number) => {
    const newLines = [...lines];
    (newLines[idx] as Record<keyof POLine, string | number>)[field] = value;
    if (field === 'item_id') {
      const item = items.find(i => i.id === value);
      if (item) newLines[idx].unit_price = item.unit_cost || 0;
    }
    setLines(newLines);
  };

  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const filtered = orders.filter(o =>
    o.po_number.toLowerCase().includes(search.toLowerCase()) ||
    o.vendors?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'po_number', header: 'PO Number', render: (o: POWithDetails) => <span className="font-medium">{o.po_number}</span> },
    { key: 'vendor', header: 'Vendor', render: (o: POWithDetails) => o.vendors?.name || '-' },
    { key: 'order_date', header: 'Order Date', render: (o: POWithDetails) => new Date(o.order_date).toLocaleDateString() },
    { key: 'total_amount', header: 'Total', render: (o: POWithDetails) => `₦${(o.total_amount || 0).toFixed(2)}` },
    { key: 'status', header: 'Status', render: (o: POWithDetails) => (
      <div>
        <StatusBadge status={o.status} />
        {o.status === 'draft' && o.rejection_reason && (
          <p className="text-xs text-destructive mt-1" title={o.rejection_reason}>⚠ {o.rejection_reason.length > 40 ? o.rejection_reason.slice(0, 40) + '…' : o.rejection_reason}</p>
        )}
      </div>
    )},
    {
      key: 'actions', header: '',
      render: (o: POWithDetails) => (
        <div className="flex gap-2 justify-end">
          {o.status === 'draft' && canInitiate && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditDialog(o); }}><Pencil className="h-3 w-3" /></Button>
          )}
          {o.status === 'draft' && canInitiate && o.created_by === user?.id && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSubmit(o); }}>Submit</Button>
          )}
          {o.status === 'pending_approval' && canApprove && (
            <>
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleApprove(o); }}>Approve</Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRejectPO(o); }}>Reject</Button>
            </>
          )}
          {o.status === 'approved' && canSend && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSend(o); }}>Send</Button>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Purchase Orders" description="Create and manage purchase orders"
          actions={<Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create PO</Button>}
        />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search POs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <DataTable columns={columns} data={filtered} loading={loading} onRowClick={po => navigate(`/purchase-orders/${po.id}`)} emptyMessage="No purchase orders found." />

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> {editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor *</Label>
                  <Select value={form.vendor_id} onValueChange={v => setForm({ ...form, vendor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ship To</Label>
                  <Select value={form.ship_to_location_id} onValueChange={v => setForm({ ...form, ship_to_location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Line Items</Label><Button type="button" variant="outline" size="sm" onClick={addLine}>Add Line</Button></div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={line.item_id} onValueChange={v => updateLine(idx, 'item_id', v)}>
                          <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-24"><Input type="number" min="1" placeholder="Qty" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                      <div className="w-28"><Input type="number" step="0.01" placeholder="Price" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                      <div className="w-24 text-right font-medium">₦{(line.quantity * line.unit_price).toFixed(2)}</div>
                      {lines.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)}>×</Button>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingPO ? 'Update PO' : 'Create PO'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

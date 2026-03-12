import { useEffect, useState } from 'react';
import { Plus, Search, Boxes, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { InventoryBalance, Item, Location, AdjustmentType } from '@/lib/supabase';

interface BalanceWithDetails extends InventoryBalance {
  items: Item | null;
  locations: Location | null;
}

export default function Inventory() {
  const { user, organizationId } = useAuth();
  const [balances, setBalances] = useState<BalanceWithDetails[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    item_id: '',
    location_id: '',
    adjustment_type: 'increase' as AdjustmentType,
    quantity: 0,
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balancesRes, itemsRes, locationsRes] = await Promise.all([
        supabase.from('inventory_balances').select('*, items(*), locations(*)'),
        supabase.from('items').select('*').eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
      ]);

      setBalances((balancesRes.data || []) as BalanceWithDetails[]);
      setItems((itemsRes.data || []) as Item[]);
      setLocations((locationsRes.data || []) as Location[]);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (!form.item_id || !form.location_id || form.quantity <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      // Check current balance for decreases
      const { data: currentBalance } = await supabase
        .from('inventory_balances')
        .select('quantity')
        .eq('item_id', form.item_id)
        .eq('location_id', form.location_id)
        .maybeSingle();

      const currentQty = currentBalance?.quantity || 0;

      if (form.adjustment_type === 'decrease' && form.quantity > currentQty) {
        toast.error(`Cannot decrease by ${form.quantity}. Current balance is only ${currentQty}`);
        setSaving(false);
        return;
      }

      // Generate adjustment number
      const adjNumber = await getNextTransactionNumber(organizationId!, 'ADJ', 'ADJ');

      // Create adjustment record
      const { data: adjustment, error: adjError } = await supabase
        .from('inventory_adjustments')
        .insert({
          adjustment_number: adjNumber,
          location_id: form.location_id,
          reason: form.reason,
          status: 'posted',
          posted_at: new Date().toISOString(),
          posted_by: user?.id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (adjError) throw adjError;

      // Create adjustment line
      const { error: lineError } = await supabase
        .from('inventory_adjustment_lines')
        .insert({
          adjustment_id: adjustment.id,
          item_id: form.item_id,
          adjustment_type: form.adjustment_type,
          quantity: form.quantity,
        });

      if (lineError) throw lineError;

      // Update inventory balance
      const newQty = form.adjustment_type === 'increase' 
        ? currentQty + form.quantity 
        : currentQty - form.quantity;

      if (currentBalance) {
        const { error: updateError } = await supabase
          .from('inventory_balances')
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq('item_id', form.item_id)
          .eq('location_id', form.location_id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('inventory_balances')
          .insert({
            item_id: form.item_id,
            location_id: form.location_id,
            quantity: newQty,
          });

        if (insertError) throw insertError;
      }

      toast.success('Inventory adjusted');
      setDialogOpen(false);
      setForm({ item_id: '', location_id: '', adjustment_type: 'increase', quantity: 0, reason: '' });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to adjust inventory';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = balances.filter(b =>
    b.items?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.items?.code?.toLowerCase().includes(search.toLowerCase()) ||
    b.locations?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { 
      key: 'item', 
      header: 'Item', 
      render: (b: BalanceWithDetails) => (
        <div>
          <p className="font-medium">{b.items?.name}</p>
          <p className="text-xs text-muted-foreground">{b.items?.code}</p>
        </div>
      )
    },
    { key: 'location', header: 'Location', render: (b: BalanceWithDetails) => b.locations?.name || '-' },
    { 
      key: 'quantity', 
      header: 'Quantity', 
      render: (b: BalanceWithDetails) => (
        <span className="font-medium">{b.quantity} {b.items?.unit_of_measure}</span>
      )
    },
    { 
      key: 'last_updated', 
      header: 'Last Updated', 
      render: (b: BalanceWithDetails) => new Date(b.last_updated).toLocaleDateString()
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Inventory"
          description="View inventory balances and make adjustments"
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Adjustment
            </Button>
          }
        />

        <Tabs defaultValue="balances">
          <TabsList>
            <TabsTrigger value="balances">Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="balances" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inventory..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <DataTable
              columns={columns}
              data={filtered}
              loading={loading}
              emptyMessage="No inventory balances found."
            />
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" /> New Inventory Adjustment
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Item *</Label>
                <Select value={form.item_id} onValueChange={v => setForm({ ...form, item_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select 
                    value={form.adjustment_type} 
                    onValueChange={v => setForm({ ...form, adjustment_type: v as AdjustmentType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="h-4 w-4 text-success" />
                          Increase
                        </div>
                      </SelectItem>
                      <SelectItem value="decrease">
                        <div className="flex items-center gap-2">
                          <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          Decrease
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Input
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjust} disabled={saving}>
                {saving ? 'Processing...' : 'Post Adjustment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

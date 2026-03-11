import { useEffect, useState } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Item } from '@/lib/supabase';

const { organizationId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    unit_of_measure: 'EA',
    unit_cost: 0,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('code');

      if (error) throw error;
      setItems((data || []) as Item[]);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and Name are required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('items').insert(form);
      if (error) throw error;
      
      toast.success('Item created');
      setDialogOpen(false);
      setForm({ code: '', name: '', description: '', category: '', unit_of_measure: 'EA', unit_cost: 0 });
      fetchItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create item';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.code.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'code', header: 'Code', render: (i: Item) => <span className="font-medium">{i.code}</span> },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (i: Item) => i.category || '-' },
    { key: 'unit_of_measure', header: 'UOM' },
    { 
      key: 'unit_cost', 
      header: 'Unit Cost', 
      render: (i: Item) => `₦${(i.unit_cost || 0).toFixed(2)}` 
    },
    { 
      key: 'is_active', 
      header: 'Status', 
      render: (i: Item) => (
        <Badge variant={i.is_active ? 'default' : 'secondary'}>
          {i.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Items"
          description="Manage your item master data"
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          }
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
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
          emptyMessage="No items found. Create your first item to get started."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" /> New Item
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="ITM001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Item Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Item description"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    placeholder="Raw Materials"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UOM</Label>
                  <Input
                    value={form.unit_of_measure}
                    onChange={e => setForm({ ...form, unit_of_measure: e.target.value.toUpperCase() })}
                    placeholder="EA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.unit_cost}
                    onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

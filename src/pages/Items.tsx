import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, Pencil, Trash2, Power } from 'lucide-react';
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

export default function Items() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    unit_of_measure: 'EA',
    unit_cost: 0,
  });

  const itemsQ = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('*').order('code');
      if (error) throw error;
      return (data || []) as Item[];
    },
  });
  const items = itemsQ.data || [];
  const loading = itemsQ.isLoading;

  const openCreate = () => {
    setEditItem(null);
    setForm({ code: '', name: '', description: '', category: '', unit_of_measure: 'EA', unit_cost: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      unit_of_measure: item.unit_of_measure,
      unit_cost: item.unit_cost || 0,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editItem) {
        const { error } = await supabase.from('items').update({
          code: form.code, name: form.name,
          description: form.description || null, category: form.category || null,
          unit_of_measure: form.unit_of_measure, unit_cost: form.unit_cost,
        }).eq('id', editItem.id);
        if (error) throw error;
        return 'updated';
      } else {
        const { error } = await supabase.from('items').insert({ ...form, organization_id: organizationId });
        if (error) throw error;
        return 'created';
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setDialogOpen(false);
      toast.success(`Item ${res}`);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save item'),
  });
  const saving = saveMutation.isPending;

  const handleSave = () => {
    if (!form.code || !form.name) { toast.error('Code and Name are required'); return; }
    saveMutation.mutate();
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async (item: Item) => {
      const { error } = await supabase.from('items').update({ is_active: !item.is_active }).eq('id', item.id);
      if (error) throw error;
      return item.is_active;
    },
    onSuccess: (wasActive) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(wasActive ? 'Item disabled' : 'Item enabled');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update item'),
  });
  const handleToggleActive = (item: Item) => toggleActiveMutation.mutate(item);

  const deleteMutation = useMutation({
    mutationFn: async (item: Item) => {
      const { error } = await supabase.from('items').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete item. It may be in use.'),
  });
  const handleDelete = (item: Item) => {
    if (!window.confirm(`Delete item "${item.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(item);
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
    {
      key: 'actions',
      header: '',
      render: (i: Item) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(i)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleToggleActive(i)} title={i.is_active ? 'Disable' : 'Enable'}>
            <Power className={`h-4 w-4 ${i.is_active ? 'text-muted-foreground' : 'text-green-600'}`} />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(i)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
            <Button onClick={openCreate}>
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
                <Package className="h-5 w-5" /> {editItem ? 'Edit Item' : 'New Item'}
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
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editItem ? 'Update Item' : 'Create Item')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

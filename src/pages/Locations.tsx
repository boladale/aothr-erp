import { useState } from 'react';
import { Plus, Search, MapPin, Pencil, Trash2, Power } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { Location } from '@/lib/supabase';

export default function Locations() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [form, setForm] = useState({ code: '', name: '', address: '' });

  const locationsQ = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').order('code');
      if (error) throw error;
      return (data || []) as Location[];
    },
  });
  const locations = locationsQ.data || [];
  const loading = locationsQ.isLoading;
  const fetchLocations = () => qc.invalidateQueries({ queryKey: ['locations'] });

  const openCreate = () => {
    setEditLocation(null);
    setForm({ code: '', name: '', address: '' });
    setDialogOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditLocation(loc);
    setForm({
      code: loc.code,
      name: loc.name,
      address: loc.address || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Code and Name are required');
      return;
    }

    setSaving(true);
    try {
      if (editLocation) {
        const { error } = await supabase.from('locations').update({
          code: form.code,
          name: form.name,
          address: form.address || null,
        }).eq('id', editLocation.id);
        if (error) throw error;
        toast.success('Location updated');
      } else {
        const { error } = await supabase.from('locations').insert({ ...form, organization_id: organizationId });
        if (error) throw error;
        toast.success('Location created');
      }
      setDialogOpen(false);
      fetchLocations();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (loc: Location) => {
    try {
      const { error } = await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id);
      if (error) throw error;
      toast.success(loc.is_active ? 'Location disabled' : 'Location enabled');
      fetchLocations();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update location');
    }
  };

  const handleDelete = async (loc: Location) => {
    if (!window.confirm(`Delete location "${loc.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('locations').delete().eq('id', loc.id);
      if (error) throw error;
      toast.success('Location deleted');
      fetchLocations();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete location. It may be in use.');
    }
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'code', header: 'Code', render: (l: Location) => <span className="font-medium">{l.code}</span> },
    { key: 'name', header: 'Name' },
    { key: 'address', header: 'Address', render: (l: Location) => l.address || '-' },
    { 
      key: 'is_active', 
      header: 'Status', 
      render: (l: Location) => (
        <Badge variant={l.is_active ? 'default' : 'secondary'}>
          {l.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: '',
      render: (l: Location) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(l)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleToggleActive(l)} title={l.is_active ? 'Disable' : 'Enable'}>
            <Power className={`h-4 w-4 ${l.is_active ? 'text-muted-foreground' : 'text-green-600'}`} />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(l)} title="Delete">
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
          title="Locations"
          description="Manage warehouse and storage locations"
          actions={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Location
            </Button>
          }
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search locations..."
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
          emptyMessage="No locations found. Create your first location to get started."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> {editLocation ? 'Edit Location' : 'New Location'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="WH01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Main Warehouse"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Warehouse St"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editLocation ? 'Update Location' : 'Create Location')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

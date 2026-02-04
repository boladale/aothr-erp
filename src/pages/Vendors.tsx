import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Vendor, VendorStatus } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function Vendors() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    payment_terms: 30,
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors((data || []) as Vendor[]);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
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
      const { error } = await supabase.from('vendors').insert({
        ...form,
        created_by: user?.id,
      });

      if (error) throw error;
      
      toast.success('Vendor created');
      setDialogOpen(false);
      setForm({ code: '', name: '', email: '', phone: '', address: '', city: '', country: '', payment_terms: 30 });
      fetchVendors();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create vendor';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (vendor: Vendor) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ status: 'pending_approval' as VendorStatus })
        .eq('id', vendor.id);

      if (error) throw error;
      toast.success('Submitted for approval');
      fetchVendors();
    } catch (error) {
      toast.error('Failed to submit');
    }
  };

  const handleApprove = async (vendor: Vendor) => {
    try {
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({ status: 'active' as VendorStatus })
        .eq('id', vendor.id);

      if (vendorError) throw vendorError;

      await supabase.from('vendor_approvals').insert({
        vendor_id: vendor.id,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      });

      toast.success('Vendor approved');
      fetchVendors();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (vendor: Vendor) => {
    try {
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({ status: 'draft' as VendorStatus })
        .eq('id', vendor.id);

      if (vendorError) throw vendorError;

      await supabase.from('vendor_approvals').insert({
        vendor_id: vendor.id,
        approved_by: user?.id,
        rejected_at: new Date().toISOString(),
      });

      toast.success('Vendor rejected');
      fetchVendors();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'code', header: 'Code', render: (v: Vendor) => <span className="font-medium">{v.code}</span> },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email', render: (v: Vendor) => v.email || '-' },
    { key: 'city', header: 'City', render: (v: Vendor) => v.city || '-' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (v: Vendor) => <StatusBadge status={v.status} /> 
    },
    {
      key: 'actions',
      header: '',
      render: (v: Vendor) => (
        <div className="flex gap-2 justify-end">
          {v.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSubmitForApproval(v); }}>
              Submit
            </Button>
          )}
          {v.status === 'pending_approval' && (
            <>
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleApprove(v); }}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleReject(v); }}>
                Reject
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
        <PageHeader
          title="Vendors"
          description="Manage your vendor master data and approvals"
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Vendor
            </Button>
          }
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
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
          emptyMessage="No vendors found. Create your first vendor to get started."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> New Vendor
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="VND001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Vendor Name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="vendor@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={form.country}
                    onChange={e => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms (days)</Label>
                <Input
                  type="number"
                  value={form.payment_terms}
                  onChange={e => setForm({ ...form, payment_terms: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create Vendor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Vendor, VendorStatus } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog';

const PROJECT_SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  enterprise: 'Enterprise',
};

export default function Vendors() {
  const { user, hasRole } = useAuth();
  const canApprove = hasRole('admin') || hasRole('procurement_manager');
  const canInitiate = !!user;
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleSubmitForApproval = async (vendor: Vendor) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ status: 'pending_approval' as VendorStatus, rejection_reason: null })
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
    const reason = window.prompt('Please enter a reason for rejection:');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    try {
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({ status: 'draft' as VendorStatus, rejection_reason: reason })
        .eq('id', vendor.id);

      if (vendorError) throw vendorError;

      await supabase.from('vendor_approvals').insert({
        vendor_id: vendor.id,
        approved_by: user?.id,
        rejected_at: new Date().toISOString(),
      });

      toast.success('Vendor returned to draft for corrections');
      fetchVendors();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase()) ||
    (v.service_categories || []).some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    { key: 'code', header: 'Code', render: (v: Vendor) => <span className="font-medium">{v.code}</span> },
    { key: 'name', header: 'Name' },
    { 
      key: 'categories', 
      header: 'Categories', 
      render: (v: Vendor) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {(v.service_categories || []).slice(0, 2).map(cat => (
            <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
          ))}
          {(v.service_categories || []).length > 2 && (
            <Badge variant="outline" className="text-xs">+{(v.service_categories || []).length - 2}</Badge>
          )}
          {(!v.service_categories || v.service_categories.length === 0) && '-'}
        </div>
      )
    },
    { 
      key: 'size', 
      header: 'Capacity', 
      render: (v: Vendor) => v.project_size_capacity ? PROJECT_SIZE_LABELS[v.project_size_capacity] : '-'
    },
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
          {v.status === 'draft' && canInitiate && v.created_by === user?.id && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSubmitForApproval(v); }}>
              Submit
            </Button>
          )}
          {v.status === 'pending_approval' && canApprove && (
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

        <VendorFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={fetchVendors}
          userId={user?.id}
        />
      </div>
    </AppLayout>
  );
}

import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Power, Link2, Ban } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ExportButton } from '@/components/ui/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Vendor, VendorStatus } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog';
import { VendorInviteDialog } from '@/components/vendors/VendorInviteDialog';

type VendorWithBlacklist = Vendor & {
  blacklist_status?: 'none' | 'pending' | 'approved' | 'rejected';
  blacklist_reason?: string | null;
  blacklist_rejection_reason?: string | null;
  blacklist_requested_at?: string | null;
  blacklist_approved_at?: string | null;
};

const PROJECT_SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  enterprise: 'Enterprise',
};

export default function Vendors() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole('admin') || hasRole('procurement_manager');
  const canInitiate = !!user;
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [inviteVendor, setInviteVendor] = useState<Vendor | null>(null);
  const [blacklistVendor, setBlacklistVendor] = useState<VendorWithBlacklist | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');

  const vendorsQ = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VendorWithBlacklist[];
    },
  });
  const vendors = vendorsQ.data || [];
  const loading = vendorsQ.isLoading;
  const fetchVendors = () => qc.invalidateQueries({ queryKey: ['vendors'] });

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

  const handleEdit = (vendor: Vendor) => {
    setEditVendor(vendor);
    setDialogOpen(true);
  };

  const handleToggleActive = async (vendor: Vendor) => {
    const newStatus: VendorStatus = vendor.status === 'inactive' ? 'active' : 'inactive';
    try {
      const { error } = await supabase.from('vendors').update({ status: newStatus }).eq('id', vendor.id);
      if (error) throw error;
      toast.success(`Vendor ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      fetchVendors();
    } catch (error) {
      toast.error('Failed to update vendor status');
    }
  };

  const openBlacklistDialog = (vendor: VendorWithBlacklist) => {
    setBlacklistVendor(vendor);
    setBlacklistReason('');
  };

  const submitBlacklistRequest = async () => {
    if (!blacklistVendor) return;
    const reason = blacklistReason.trim();
    if (!reason) { toast.error('A reason is required to blacklist a vendor'); return; }
    try {
      const { error } = await (supabase.from('vendors') as any).update({
        blacklist_status: 'pending',
        blacklist_reason: reason,
        blacklist_requested_by: user?.id,
        blacklist_requested_at: new Date().toISOString(),
        blacklist_rejection_reason: null,
        blacklist_approved_by: null,
        blacklist_approved_at: null,
      }).eq('id', blacklistVendor.id);
      if (error) throw error;
      toast.success('Blacklist request submitted for manager approval');
      setBlacklistVendor(null);
      setBlacklistReason('');
      fetchVendors();
    } catch (e) {
      toast.error('Failed to submit blacklist request');
    }
  };

  const handleApproveBlacklist = async (vendor: VendorWithBlacklist) => {
    if (!window.confirm(`Approve blacklist for "${vendor.name}"? This will block the vendor from any new transactions.`)) return;
    try {
      const { error } = await (supabase.from('vendors') as any).update({
        status: 'blacklisted',
        blacklist_status: 'approved',
        blacklist_approved_by: user?.id,
        blacklist_approved_at: new Date().toISOString(),
      }).eq('id', vendor.id);
      if (error) throw error;
      toast.success('Vendor blacklisted');
      fetchVendors();
    } catch (e) {
      toast.error('Failed to approve blacklist');
    }
  };

  const handleRejectBlacklist = async (vendor: VendorWithBlacklist) => {
    const reason = window.prompt('Reason for rejecting this blacklist request:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('A rejection reason is required'); return; }
    try {
      const { error } = await (supabase.from('vendors') as any).update({
        blacklist_status: 'rejected',
        blacklist_rejection_reason: reason,
      }).eq('id', vendor.id);
      if (error) throw error;
      toast.success('Blacklist request rejected');
      fetchVendors();
    } catch (e) {
      toast.error('Failed to reject blacklist request');
    }
  };

  const handleRemoveBlacklist = async (vendor: VendorWithBlacklist) => {
    if (!window.confirm(`Remove blacklist from "${vendor.name}" and reinstate as active?`)) return;
    try {
      const { error } = await (supabase.from('vendors') as any).update({
        status: 'active',
        blacklist_status: 'none',
        blacklist_reason: null,
        blacklist_requested_by: null,
        blacklist_requested_at: null,
        blacklist_approved_by: null,
        blacklist_approved_at: null,
        blacklist_rejection_reason: null,
      }).eq('id', vendor.id);
      if (error) throw error;
      toast.success('Vendor reinstated');
      fetchVendors();
    } catch (e) {
      toast.error('Failed to remove blacklist');
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!window.confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return;
    try {
      // Check for references in POs, invoices, bids, RFP responses
      const checks = await Promise.all([
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
        supabase.from('ap_invoices').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
        supabase.from('rfp_proposals').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
        supabase.from('requisition_bid_entries').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
      ]);
      const totalRefs = checks.reduce((sum, r) => sum + (r.count || 0), 0);
      if (totalRefs > 0) {
        toast.error('Cannot delete: vendor has existing transactions or bids');
        return;
      }
      // Delete documents first, then vendor
      await supabase.from('vendor_documents').delete().eq('vendor_id', vendor.id);
      await supabase.from('vendor_approvals').delete().eq('vendor_id', vendor.id);
      const { error } = await supabase.from('vendors').delete().eq('id', vendor.id);
      if (error) throw error;
      toast.success('Vendor deleted');
      fetchVendors();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete vendor';
      toast.error(msg);
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
      render: (v: VendorWithBlacklist) => (
        <div>
          <StatusBadge status={v.status} />
          {v.status === 'draft' && v.rejection_reason && (
            <p className="text-xs text-destructive mt-1" title={v.rejection_reason}>⚠ {v.rejection_reason.length > 40 ? v.rejection_reason.slice(0, 40) + '…' : v.rejection_reason}</p>
          )}
          {v.blacklist_status === 'pending' && (
            <Badge variant="outline" className="mt-1 text-xs border-amber-500 text-amber-700">Blacklist pending</Badge>
          )}
          {v.status === 'blacklisted' && v.blacklist_reason && (
            <p className="text-xs text-destructive mt-1" title={v.blacklist_reason}>⛔ {v.blacklist_reason.length > 40 ? v.blacklist_reason.slice(0, 40) + '…' : v.blacklist_reason}</p>
          )}
          {v.blacklist_status === 'rejected' && v.blacklist_rejection_reason && (
            <p className="text-xs text-muted-foreground mt-1" title={v.blacklist_rejection_reason}>Blacklist rejected: {v.blacklist_rejection_reason.length > 30 ? v.blacklist_rejection_reason.slice(0, 30) + '…' : v.blacklist_rejection_reason}</p>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      header: '',
      render: (v: VendorWithBlacklist) => (
        <div className="flex gap-2 justify-end">
          {v.status === 'draft' && canInitiate && (v.created_by === user?.id || canApprove) && (
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
          {v.blacklist_status === 'pending' && canApprove && (
            <>
              <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleApproveBlacklist(v); }}>
                Approve Blacklist
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRejectBlacklist(v); }}>
                Reject
              </Button>
            </>
          )}
          {v.status === 'draft' && (
            <Button size="sm" variant="ghost" title="Edit" onClick={(e) => { e.stopPropagation(); handleEdit(v); }}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {(v.status === 'active' || v.status === 'inactive') && (
            <Button size="sm" variant="ghost" title={v.status === 'active' ? 'Disable' : 'Enable'} onClick={(e) => { e.stopPropagation(); handleToggleActive(v); }}>
              <Power className={`h-4 w-4 ${v.status === 'inactive' ? 'text-muted-foreground' : ''}`} />
            </Button>
          )}
          {(v.status === 'active' || v.status === 'inactive') && v.blacklist_status !== 'pending' && (
            <Button size="sm" variant="ghost" title="Request Blacklist" onClick={(e) => { e.stopPropagation(); openBlacklistDialog(v); }}>
              <Ban className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {v.status === 'blacklisted' && canApprove && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRemoveBlacklist(v); }}>
              Remove Blacklist
            </Button>
          )}
          {v.status === 'active' && v.email && (
            <Button size="sm" variant="ghost" title="Invite to Portal" onClick={(e) => { e.stopPropagation(); setInviteVendor(v); }}>
              <Link2 className="h-4 w-4" />
            </Button>
          )}
          {v.status === 'draft' && (
            <Button size="sm" variant="ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(v); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
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
          <div className="ml-auto">
            <ExportButton
              filename="vendors"
              sheetName="Vendors"
              rows={filtered.map(v => ({
                Code: v.code,
                Name: v.name,
                Email: v.email || '',
                Phone: v.phone || '',
                Address: v.address || '',
                City: v.city || '',
                Country: v.country || '',
                Categories: (v.service_categories || []).join(', '),
                'Project Capacity': v.project_size_capacity || '',
                'Bank Name': v.bank_name || '',
                'Bank Account': v.bank_account_number || '',
                'Payment Terms (Days)': v.payment_terms || '',
                Status: v.status,
              }))}
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
          onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditVendor(null); }}
          onSuccess={fetchVendors}
          userId={user?.id}
          editVendor={editVendor}
        />

        {inviteVendor && (
          <VendorInviteDialog
            open={!!inviteVendor}
            onOpenChange={(open) => { if (!open) setInviteVendor(null); }}
            vendorId={inviteVendor.id}
            vendorName={inviteVendor.name}
            vendorEmail={inviteVendor.email}
          />
        )}
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { BulkActionBar } from '@/components/ui/bulk-action-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { RequisitionFormDialog } from '@/components/requisitions/RequisitionFormDialog';

interface RequisitionRow {
  id: string;
  req_number: string;
  requester_id: string;
  department: string | null;
  status: string;
  justification: string | null;
  rejection_reason: string | null;
  needed_by_date: string | null;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
}

export default function Requisitions() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const canApprove = hasRole('admin') || hasRole('procurement_manager');
  const canInitiate = !!user;
  const [requisitions, setRequisitions] = useState<RequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editReq, setEditReq] = useState<RequisitionRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => { fetchRequisitions(); }, []);

  const fetchRequisitions = async () => {
    try {
      const { data, error } = await supabase
        .from('requisitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequisitions((data || []).map(r => ({ ...r, profiles: null })) as RequisitionRow[]);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (req: RequisitionRow) => {
    try {
      const { error } = await supabase.from('requisitions').update({ status: 'pending_approval', submitted_at: new Date().toISOString() }).eq('id', req.id);
      if (error) throw error;
      toast.success('Submitted for approval');
      fetchRequisitions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    }
  };

  const handleApprove = async (req: RequisitionRow) => {
    if (req.status !== 'pending_approval') { toast.error('Only pending requisitions can be approved'); return; }
    try {
      const { error } = await supabase.from('requisitions').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id }).eq('id', req.id);
      if (error) throw error;
      toast.success('Requisition approved');
      fetchRequisitions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    }
  };

  const handleReject = async (req: RequisitionRow) => {
    const reason = window.prompt('Please enter a reason for rejection:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('A rejection reason is required'); return; }
    try {
      const { error } = await supabase.from('requisitions').update({
        status: 'draft', rejection_reason: reason, rejected_at: new Date().toISOString(), rejected_by: user?.id, submitted_at: null
      }).eq('id', req.id);
      if (error) throw error;
      toast.success('Requisition returned to draft for corrections');
      fetchRequisitions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    }
  };

  const handleEdit = (req: RequisitionRow) => { setEditReq(req); setDialogOpen(true); };

  const handleDelete = async (req: RequisitionRow) => {
    if (req.status !== 'draft') { toast.error('Only draft requisitions can be deleted'); return; }
    if (!window.confirm(`Delete requisition ${req.req_number}? This cannot be undone.`)) return;
    try {
      await supabase.from('requisition_lines').delete().eq('requisition_id', req.id);
      const { error } = await supabase.from('requisitions').delete().eq('id', req.id);
      if (error) throw error;
      toast.success('Requisition deleted');
      fetchRequisitions();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    }
  };

  // Bulk operations
  const handleBulkApprove = async () => {
    const pendingIds = selectedIds.filter(id => {
      const r = requisitions.find(req => req.id === id);
      return r?.status === 'pending_approval';
    });
    if (pendingIds.length === 0) { toast.error('No pending requisitions selected'); return; }
    if (!window.confirm(`Approve ${pendingIds.length} requisitions?`)) return;
    setBulkProcessing(true);
    try {
      const { error } = await supabase.from('requisitions').update({
        status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id
      }).in('id', pendingIds);
      if (error) throw error;
      toast.success(`${pendingIds.length} requisitions approved`);
      setSelectedIds([]);
      fetchRequisitions();
    } catch (e: any) { toast.error(e.message); } finally { setBulkProcessing(false); }
  };

  const handleBulkReject = async () => {
    const pendingIds = selectedIds.filter(id => {
      const r = requisitions.find(req => req.id === id);
      return r?.status === 'pending_approval';
    });
    if (pendingIds.length === 0) { toast.error('No pending requisitions selected'); return; }
    const reason = window.prompt(`Reject ${pendingIds.length} requisitions. Enter reason:`);
    if (!reason?.trim()) { toast.error('Reason required'); return; }
    setBulkProcessing(true);
    try {
      const { error } = await supabase.from('requisitions').update({
        status: 'draft', rejection_reason: reason, rejected_at: new Date().toISOString(), rejected_by: user?.id, submitted_at: null
      }).in('id', pendingIds);
      if (error) throw error;
      toast.success(`${pendingIds.length} requisitions rejected`);
      setSelectedIds([]);
      fetchRequisitions();
    } catch (e: any) { toast.error(e.message); } finally { setBulkProcessing(false); }
  };

  const filtered = requisitions.filter(r =>
    r.req_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'req_number', header: 'Req #', render: (r: RequisitionRow) => <span className="font-medium">{r.req_number}</span> },
    { key: 'requester', header: 'Requester', render: (r: RequisitionRow) => r.profiles?.full_name || r.profiles?.email || '-' },
    { key: 'department', header: 'Department', render: (r: RequisitionRow) => r.department || '-' },
    { key: 'needed_by_date', header: 'Needed By', render: (r: RequisitionRow) => r.needed_by_date ? new Date(r.needed_by_date).toLocaleDateString() : '-' },
    { key: 'status', header: 'Status', render: (r: RequisitionRow) => (
      <div>
        <StatusBadge status={r.status} />
        {r.status === 'draft' && r.rejection_reason && (
          <p className="text-xs text-destructive mt-1" title={r.rejection_reason}>⚠ {r.rejection_reason.length > 40 ? r.rejection_reason.slice(0, 40) + '…' : r.rejection_reason}</p>
        )}
      </div>
    )},
    {
      key: 'actions', header: '',
      render: (r: RequisitionRow) => (
        <div className="flex gap-2 justify-end">
          {r.status === 'draft' && canInitiate && r.requester_id === user?.id && (
            <>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(r); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(r); }} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSubmit(r); }}>Submit</Button>
            </>
          )}
          {r.status === 'pending_approval' && canApprove && (
            <>
              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleApprove(r); }}>Approve</Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleReject(r); }}>Reject</Button>
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
          title="Requisitions"
          description="Create and manage procurement requisitions"
          actions={<Button onClick={() => { setEditReq(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New Requisition</Button>}
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requisitions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {canApprove && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onClearSelection={() => setSelectedIds([])}
            actions={[
              { label: 'Approve', icon: <CheckCircle className="h-4 w-4 mr-1" />, onClick: handleBulkApprove, disabled: bulkProcessing, variant: 'default' },
              { label: 'Reject', icon: <XCircle className="h-4 w-4 mr-1" />, onClick: handleBulkReject, disabled: bulkProcessing, variant: 'destructive' },
            ]}
          />
        )}

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={r => navigate(`/requisitions/${r.id}`)}
          emptyMessage="No requisitions found. Create your first requisition to get started."
          selectable={canApprove}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        <RequisitionFormDialog
          open={dialogOpen}
          onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditReq(null); }}
          onSuccess={fetchRequisitions}
          editRequisition={editReq}
        />
      </div>
    </AppLayout>
  );
}

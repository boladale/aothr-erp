import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

export function VendorRegistrationsPanel() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ['vendor-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_registration_requests' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (registration: any) => {
      // 1. Create vendor record
      const vendorCode = 'V-' + registration.company_name.substring(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const { data: vendor, error: vendorError } = await supabase.from('vendors').insert({
        name: registration.company_name,
        code: vendorCode,
        email: registration.contact_email,
        phone: registration.contact_phone,
        address: registration.address,
        status: 'active',
        organization_id: organizationId,
      } as any).select().single();
      if (vendorError) throw vendorError;

      // 2. Create vendor_users link
      const { error: linkError } = await supabase.from('vendor_users' as any).insert({
        user_id: registration.user_id,
        vendor_id: vendor.id,
        is_active: true,
      } as any);
      if (linkError) throw linkError;

      // 3. Assign vendor_user role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: registration.user_id,
        role: 'vendor_user' as any,
      } as any);
      // Ignore duplicate role error
      if (roleError && roleError.code !== '23505') throw roleError;

      // 4. Update registration status
      const { error: updateError } = await supabase
        .from('vendor_registration_requests' as any)
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
        .eq('id', registration.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Vendor registration approved! Vendor account is now active.');
      queryClient.invalidateQueries({ queryKey: ['vendor-registrations'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to approve registration'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('vendor_registration_requests' as any)
        .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString(), rejection_reason: reason } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vendor registration rejected.');
      queryClient.invalidateQueries({ queryKey: ['vendor-registrations'] });
      setRejectDialog({ open: false, id: null });
      setRejectionReason('');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reject registration'),
  });

  const columns = [
    { key: 'company_name', header: 'Company', render: (r: any) => <span className="font-medium">{r.company_name}</span> },
    { key: 'contact_email', header: 'Email' },
    { key: 'contact_phone', header: 'Phone', render: (r: any) => r.contact_phone || '-' },
    { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'created_at', header: 'Submitted', render: (r: any) => format(new Date(r.created_at), 'dd MMM yyyy HH:mm') },
    {
      key: 'actions', header: '', render: (r: any) => r.status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); approveMutation.mutate(r); }} disabled={approveMutation.isPending}>
            <CheckCircle className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setRejectDialog({ open: true, id: r.id }); }}>
            <XCircle className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Vendor Registration Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={registrations as any[]} loading={isLoading} emptyMessage="No vendor registration requests" />
        </CardContent>
      </Card>

      <Dialog open={rejectDialog.open} onOpenChange={(o) => { if (!o) setRejectDialog({ open: false, id: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for rejection</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter reason..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectDialog.id && rejectMutation.mutate({ id: rejectDialog.id, reason: rejectionReason })} disabled={rejectMutation.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

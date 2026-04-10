import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Building2, Search, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

export function VendorRegistrationsPanel() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; registration: any | null }>({ open: false, registration: null });
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

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

  // Search existing vendors for linking
  const { data: matchingVendors = [] } = useQuery({
    queryKey: ['vendor-search-for-link', vendorSearch],
    queryFn: async () => {
      if (!vendorSearch || vendorSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('vendors')
        .select('id, code, name, email, rc_number')
        .or(`name.ilike.%${vendorSearch}%,rc_number.ilike.%${vendorSearch}%,code.ilike.%${vendorSearch}%`)
        .eq('status', 'active')
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: linkMode === 'existing' && vendorSearch.length >= 2,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ registration, vendorId }: { registration: any; vendorId: string | null }) => {
      let finalVendorId = vendorId;

      if (!finalVendorId) {
        // Create new vendor record
        const vendorCode = 'V-' + registration.company_name.substring(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4);
        const { data: vendor, error: vendorError } = await supabase.from('vendors').insert({
          name: registration.company_name,
          code: vendorCode,
          email: registration.contact_email || registration.email,
          phone: registration.contact_phone || registration.phone,
          address: registration.address,
          rc_number: registration.rc_number,
          status: 'active',
          organization_id: organizationId,
        } as any).select().single();
        if (vendorError) throw vendorError;
        finalVendorId = vendor.id;
      }

      // Create vendor_users link
      const { error: linkError } = await supabase.from('vendor_users' as any).insert({
        user_id: registration.user_id,
        vendor_id: finalVendorId,
        is_active: true,
      } as any);
      if (linkError) throw linkError;

      // Assign vendor_user role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: registration.user_id,
        role: 'vendor_user' as any,
      } as any);
      if (roleError && roleError.code !== '23505') throw roleError;

      // Update registration status
      const { error: updateError } = await supabase
        .from('vendor_registration_requests' as any)
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
        .eq('id', registration.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Vendor registration approved! Vendor account is now active.');
      queryClient.invalidateQueries({ queryKey: ['vendor-registrations'] });
      setApproveDialog({ open: false, registration: null });
      setLinkMode('new');
      setSelectedVendorId(null);
      setVendorSearch('');
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
    { key: 'company_name', header: 'Company', render: (r: any) => (
      <div>
        <span className="font-medium">{r.company_name}</span>
        {r.rc_number && <span className="block text-xs text-muted-foreground">RC: {r.rc_number}</span>}
      </div>
    )},
    { key: 'contact_email', header: 'Email', render: (r: any) => r.contact_email || r.email || '-' },
    { key: 'contact_phone', header: 'Phone', render: (r: any) => r.contact_phone || r.phone || '-' },
    { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'created_at', header: 'Submitted', render: (r: any) => format(new Date(r.created_at), 'dd MMM yyyy HH:mm') },
    {
      key: 'actions', header: '', render: (r: any) => r.status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setApproveDialog({ open: true, registration: r }); }}>
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

      {/* Approve Dialog - with vendor matching */}
      <Dialog open={approveDialog.open} onOpenChange={(o) => { if (!o) { setApproveDialog({ open: false, registration: null }); setLinkMode('new'); setSelectedVendorId(null); setVendorSearch(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Vendor Registration</DialogTitle>
          </DialogHeader>
          {approveDialog.registration && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                <p><strong>Company:</strong> {approveDialog.registration.company_name}</p>
                {approveDialog.registration.rc_number && <p><strong>RC Number:</strong> {approveDialog.registration.rc_number}</p>}
                <p><strong>Email:</strong> {approveDialog.registration.contact_email || approveDialog.registration.email}</p>
              </div>

              <div className="space-y-3">
                <Label>Link to vendor record</Label>
                <RadioGroup value={linkMode} onValueChange={(v) => { setLinkMode(v as 'new' | 'existing'); setSelectedVendorId(null); }}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new-vendor" />
                    <Label htmlFor="new-vendor" className="font-normal">Create new vendor record</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id="existing-vendor" />
                    <Label htmlFor="existing-vendor" className="font-normal">Link to existing vendor</Label>
                  </div>
                </RadioGroup>
              </div>

              {linkMode === 'existing' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, RC number, or code..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {matchingVendors.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {matchingVendors.map((v: any) => (
                        <button
                          key={v.id}
                          className={`w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0 ${selectedVendorId === v.id ? 'bg-primary/10 border-primary' : ''}`}
                          onClick={() => setSelectedVendorId(v.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{v.name}</span>
                              <span className="text-muted-foreground ml-2">({v.code})</span>
                              {v.rc_number && <span className="block text-xs text-muted-foreground">RC: {v.rc_number}</span>}
                            </div>
                            {selectedVendorId === v.id && <Link2 className="h-4 w-4 text-primary" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {vendorSearch.length >= 2 && matchingVendors.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No matching vendors found</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialog({ open: false, registration: null }); setLinkMode('new'); setSelectedVendorId(null); setVendorSearch(''); }}>Cancel</Button>
            <Button
              onClick={() => approveDialog.registration && approveMutation.mutate({
                registration: approveDialog.registration,
                vendorId: linkMode === 'existing' ? selectedVendorId : null,
              })}
              disabled={approveMutation.isPending || (linkMode === 'existing' && !selectedVendorId)}
            >
              {approveMutation.isPending ? 'Processing...' : linkMode === 'existing' ? 'Link & Approve' : 'Create & Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
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

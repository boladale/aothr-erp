import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SignatureUploader } from '@/components/signatures/SignatureUploader';
import { PODocumentDialog } from '@/components/purchase-orders/PODocumentDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Eye } from 'lucide-react';

interface Props {
  vendorId: string;
  userId: string;
  purchaseOrders: any[];
}

export function VendorPOAcceptance({ vendorId, userId, purchaseOrders }: Props) {
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; po: any; action: 'accepted' | 'rejected' }>({ open: false, po: null, action: 'accepted' });
  const [notes, setNotes] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [viewPOId, setViewPOId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('vendor_users' as any).select('signature_url').eq('user_id', userId).maybeSingle()
      .then(({ data }: any) => { if (data?.signature_url) setSignatureUrl(data.signature_url); });
  }, [userId]);

  const { data: acknowledgments = [] } = useQuery({
    queryKey: ['vendor-po-acks', vendorId],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_po_acknowledgments' as any).select('*').eq('vendor_id', vendorId);
      return data || [];
    },
    enabled: !!vendorId,
  });

  const ackMap = new Map((acknowledgments as any[]).map((a: any) => [a.po_id, a]));

  const submitAck = useMutation({
    mutationFn: async ({ poId, action, notes }: { poId: string; action: 'accepted' | 'rejected'; notes: string }) => {
      if (action === 'accepted' && !signatureUrl) {
        throw new Error('Please upload your signature before accepting the PO.');
      }
      if (action === 'rejected' && (!notes || notes.trim().length < 10)) {
        throw new Error('A rejection reason of at least 10 characters is required.');
      }
      const { error } = await supabase.from('vendor_po_acknowledgments' as any).insert({
        po_id: poId, vendor_id: vendorId, action, acknowledged_by: userId, notes,
      } as any);
      if (error) throw error;

      // Acceptance updates the PO directly. Rejection is handled by a DB trigger
      // that cancels the PO, notifies procurement, and opens a re-award request.
      if (action === 'accepted') {
        const { error: poErr } = await supabase.from('purchase_orders').update({
          acceptance_status: 'vendor_accepted',
          vendor_signature_url: signatureUrl,
          vendor_signed_at: new Date().toISOString(),
          vendor_signed_by: userId,
        } as any).eq('id', poId);
        if (poErr) throw poErr;
        if (signatureUrl) {
          await supabase.from('vendor_users' as any).update({ signature_url: signatureUrl }).eq('user_id', userId);
        }
      }
    },
    onSuccess: () => {
      toast.success('Purchase order response recorded.');
      setActionDialog({ open: false, po: null, action: 'accepted' });
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['vendor-po-acks'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-pos'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to respond'),
  });

  const viewPODetails = (po: any) => {
    setViewPOId(po.id);
  };

  // Only show POs in sent/approved status for acceptance
  const actionablePOs = purchaseOrders.filter((po: any) => ['sent', 'approved'].includes(po.status));
  const allPOs = purchaseOrders;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acceptance</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allPOs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow>
            ) : allPOs.map((po: any) => {
              const ack = ackMap.get(po.id);
              return (
                <TableRow key={po.id}>
                  <TableCell className="font-mono">{po.po_number}</TableCell>
                  <TableCell>{format(new Date(po.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{Number(po.total_amount).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell>
                    {ack ? (
                      <Badge className={ack.action === 'accepted' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                        {ack.action === 'accepted' ? 'Accepted' : 'Rejected'}
                      </Badge>
                    ) : ['sent', 'approved'].includes(po.status) ? (
                      <span className="text-muted-foreground text-sm">Pending response</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => viewPODetails(po)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      {['sent', 'approved'].includes(po.status) && !ack && (
                        <>
                          <Button size="sm" onClick={() => { setActionDialog({ open: true, po, action: 'accepted' }); setNotes(''); }}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setActionDialog({ open: true, po, action: 'rejected' }); setNotes(''); }}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Accept/Reject Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(o) => { if (!o) setActionDialog({ ...actionDialog, open: false }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog.action === 'accepted' ? 'Accept' : 'Reject'} Purchase Order</DialogTitle>
            <DialogDescription>
              PO: {actionDialog.po?.po_number} — Amount: {Number(actionDialog.po?.total_amount || 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {actionDialog.action === 'accepted' && (
              <SignatureUploader
                userId={userId}
                currentUrl={signatureUrl}
                onUploaded={(url) => setSignatureUrl(url)}
                label="Your Signature (required to accept)"
              />
            )}
            <div className="space-y-2">
              <Label>
                {actionDialog.action === 'rejected'
                  ? 'Reason for Rejection (required, min 10 characters)'
                  : 'Notes (optional)'}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={actionDialog.action === 'rejected' ? 'Explain why you are rejecting this PO...' : 'Any comments...'}
              />
              {actionDialog.action === 'rejected' && (
                <p className="text-xs text-muted-foreground">
                  Rejecting will cancel this PO and notify the procurement team. If this PO came from an RFP, the runner-up bidder will be proposed for re-award.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ ...actionDialog, open: false })}>Cancel</Button>
            <Button
              variant={actionDialog.action === 'accepted' ? 'default' : 'destructive'}
              onClick={() => submitAck.mutate({ poId: actionDialog.po.id, action: actionDialog.action, notes })}
              disabled={submitAck.isPending || (actionDialog.action === 'rejected' && notes.trim().length < 10)}
            >
              {actionDialog.action === 'accepted' ? 'Accept PO' : 'Reject PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Document Dialog - full PO copy */}
      {viewPOId && (
        <PODocumentDialog
          open={!!viewPOId}
          onOpenChange={(o) => { if (!o) setViewPOId(null); }}
          poId={viewPOId}
        />
      )}
    </>
  );
}

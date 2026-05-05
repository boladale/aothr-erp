import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; po: any }>({ open: false, po: null });
  const [poLines, setPOLines] = useState<any[]>([]);

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
    mutationFn: async ({ poId, action, notes }: { poId: string; action: string; notes: string }) => {
      const { error } = await supabase.from('vendor_po_acknowledgments' as any).insert({
        po_id: poId,
        vendor_id: vendorId,
        action,
        acknowledged_by: userId,
        notes,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Purchase order response recorded.');
      setActionDialog({ open: false, po: null, action: 'accepted' });
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['vendor-po-acks'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to respond'),
  });

  const viewPODetails = async (po: any) => {
    const { data } = await supabase.from('purchase_order_lines').select('*, items(code, name), services(code, name)').eq('po_id', po.id);
    setPOLines(data || []);
    setDetailDialog({ open: true, po });
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
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any comments..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ ...actionDialog, open: false })}>Cancel</Button>
            <Button
              variant={actionDialog.action === 'accepted' ? 'default' : 'destructive'}
              onClick={() => submitAck.mutate({ poId: actionDialog.po.id, action: actionDialog.action, notes })}
              disabled={submitAck.isPending}
            >
              {actionDialog.action === 'accepted' ? 'Accept PO' : 'Reject PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(o) => { if (!o) setDetailDialog({ open: false, po: null }); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase Order: {detailDialog.po?.po_number}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poLines.map((line: any, i: number) => (
                <TableRow key={line.id}>
                  <TableCell>{line.line_number || i + 1}</TableCell>
                  <TableCell>{line.items ? `${line.items.code} - ${line.items.name}` : line.services ? `${line.services.code} - ${line.services.name}` : (line.description || '-')}</TableCell>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>{Number(line.unit_price).toLocaleString()}</TableCell>
                  <TableCell>{Number(line.line_total).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-right font-semibold">Total: {Number(detailDialog.po?.total_amount || 0).toLocaleString()}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

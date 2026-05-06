import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function POReawardPanel() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; req: any; action: 'approve' | 'reject' }>({ open: false, req: null, action: 'approve' });
  const [notes, setNotes] = useState('');

  const canManage = hasRole('admin') || hasRole('procurement_manager') || hasRole('procurement_officer');

  const { data: requests = [] } = useQuery({
    queryKey: ['po-reaward-requests'],
    queryFn: async () => {
      const { data } = await supabase
        .from('po_reaward_requests' as any)
        .select(`
          *,
          original_po:purchase_orders!po_reaward_requests_original_po_id_fkey(po_number, vendor_id, vendors(name)),
          rfp:rfps(rfp_number, title),
          runner_up_vendor:vendors!po_reaward_requests_runner_up_vendor_id_fkey(name, code)
        `)
        .in('status', ['pending_approval', 'no_runner_up'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: canManage,
  });

  const action = useMutation({
    mutationFn: async ({ id, act, notes }: { id: string; act: 'approve' | 'reject'; notes: string }) => {
      const fn = act === 'approve' ? 'approve_po_reaward' : 'reject_po_reaward';
      const { error } = await supabase.rpc(fn as any, { p_request_id: id, p_notes: notes || null });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.act === 'approve' ? 'Re-award approved — new PO created' : 'Re-award rejected');
      setDialog({ open: false, req: null, action: 'approve' });
      setNotes('');
      qc.invalidateQueries({ queryKey: ['po-reaward-requests'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: any) => toast.error(err.message || 'Action failed'),
  });

  if (!canManage || (requests as any[]).length === 0) return null;

  return (
    <>
      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            PO Re-Award Requests ({(requests as any[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Original PO</TableHead>
                <TableHead>RFP</TableHead>
                <TableHead>Runner-Up Vendor</TableHead>
                <TableHead>Proposed Total</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests as any[]).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">
                    {r.original_po?.po_number}
                    <div className="text-xs text-muted-foreground">Rejected by {r.original_po?.vendors?.name}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.rfp?.rfp_number}</TableCell>
                  <TableCell>
                    {r.runner_up_vendor ? (
                      <>
                        <div className="font-medium">{r.runner_up_vendor.name}</div>
                        <div className="text-xs text-muted-foreground">{r.runner_up_vendor.code}</div>
                      </>
                    ) : (
                      <Badge variant="destructive">No runner-up</Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.proposed_total ? formatCurrency(r.proposed_total) : '—'}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs whitespace-pre-wrap line-clamp-3">{r.proposed_payment_terms || '—'}</div>
                  </TableCell>
                  <TableCell>
                    {r.status === 'no_runner_up' ? (
                      <Badge variant="destructive">No runner-up</Badge>
                    ) : (
                      <Badge variant="secondary">Pending approval</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending_approval' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => { setDialog({ open: true, req: r, action: 'approve' }); setNotes(''); }}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setDialog({ open: true, req: r, action: 'reject' }); setNotes(''); }}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) setDialog({ ...dialog, open: false }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.action === 'approve' ? 'Approve' : 'Reject'} Re-Award</DialogTitle>
            <DialogDescription>
              {dialog.action === 'approve'
                ? `Create a new PO for ${dialog.req?.runner_up_vendor?.name} at ${dialog.req?.proposed_total ? formatCurrency(dialog.req.proposed_total) : ''} using the runner-up's quoted price and payment terms.`
                : 'Rejecting will close this re-award request and notify procurement to re-open the RFP manually.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{dialog.action === 'reject' ? 'Reason (required, min 5 chars)' : 'Approval notes (optional)'}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ ...dialog, open: false })}>Cancel</Button>
            <Button
              variant={dialog.action === 'approve' ? 'default' : 'destructive'}
              onClick={() => action.mutate({ id: dialog.req.id, act: dialog.action, notes })}
              disabled={action.isPending || (dialog.action === 'reject' && notes.trim().length < 5)}
            >
              {dialog.action === 'approve' ? 'Approve & Create PO' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

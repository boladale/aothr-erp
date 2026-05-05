import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Send } from 'lucide-react';

interface Props {
  vendorId: string;
}

export function VendorQuoteRequests({ vendorId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [linePrices, setLinePrices] = useState<Record<string, { unit_price: number; notes: string }>>({});
  const [headerNotes, setHeaderNotes] = useState('');

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['vendor-bid-invites', vendorId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('bid_invitations' as any)
        .select('*, requisition_bid_requests(id, requisition_id, status, deadline, notes, requisitions(req_number, department, justification, needed_by_date, requisition_type))')
        .eq('vendor_id', vendorId)
        .order('invited_at', { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  const openQuoteDialog = async (inv: any) => {
    const reqId = inv.requisition_bid_requests?.requisition_id;
    if (!reqId) return;
    const [linesRes, mineRes] = await Promise.all([
      (supabase.from('requisition_lines') as any)
        .select('*, items(code, name, unit_of_measure), services:service_id(code, name, description)')
        .eq('requisition_id', reqId)
        .order('line_number'),
      supabase.from('requisition_bid_entries').select('*').eq('bid_request_id', inv.bid_request_id).eq('vendor_id', vendorId),
    ]);
    const lines = linesRes.data || [];
    const mine = mineRes.data || [];
    const seed: Record<string, { unit_price: number; notes: string }> = {};
    lines.forEach((l: any) => {
      const existing = mine.find((m: any) => m.requisition_line_id === l.id);
      seed[l.id] = {
        unit_price: existing?.unit_price ?? 0,
        notes: existing?.notes ?? '',
      };
    });
    setActive({ ...inv, lines });
    setLinePrices(seed);
    setHeaderNotes('');
    setOpen(true);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const rows = active.lines.map((l: any) => ({
        bid_request_id: active.bid_request_id,
        vendor_id: vendorId,
        requisition_line_id: l.id,
        unit_price: linePrices[l.id]?.unit_price || 0,
        quantity: l.quantity,
        notes: linePrices[l.id]?.notes || headerNotes || null,
      }));
      const { error } = await supabase.from('requisition_bid_entries').upsert(rows, {
        onConflict: 'bid_request_id,vendor_id,requisition_line_id',
      });
      if (error) throw error;
      // mark invitation as quoted
      await (supabase.from('bid_invitations' as any)
        .update({ status: 'quoted', responded_at: new Date().toISOString() })
        .eq('id', active.id) as any);
    },
    onSuccess: () => {
      toast.success('Quote submitted successfully');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['vendor-bid-invites'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to submit quote'),
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requisition #</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Needed By</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invites.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No quote requests yet</TableCell></TableRow>
            ) : invites.map((inv: any) => {
              const req = inv.requisition_bid_requests?.requisitions;
              const brStatus = inv.requisition_bid_requests?.status;
              const canQuote = brStatus === 'open';
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono">{req?.req_number || '-'}</TableCell>
                  <TableCell>{req?.department || '-'}</TableCell>
                  <TableCell>{req?.needed_by_date ? format(new Date(req.needed_by_date), 'dd MMM yyyy') : '-'}</TableCell>
                  <TableCell>{format(new Date(inv.invited_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'quoted' ? 'default' : 'secondary'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canQuote && (
                      <Button size="sm" onClick={() => openQuoteDialog(inv)}>
                        <Send className="h-4 w-4 mr-1" /> {inv.status === 'quoted' ? 'Update Quote' : 'Submit Quote'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Submit Quote — {active?.requisition_bid_requests?.requisitions?.req_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {active?.requisition_bid_requests?.requisitions?.justification && (
              <div className="text-sm p-3 bg-muted/40 rounded">
                <span className="font-medium">Justification: </span>
                {active.requisition_bid_requests.requisitions.justification}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active?.lines?.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      {l.items ? `${l.items.code} - ${l.items.name}` : l.services ? `${l.services.code} - ${l.services.name}` : '-'}
                    </TableCell>
                    <TableCell>{l.items?.unit_of_measure || (l.services ? 'Service' : '-')}</TableCell>
                    <TableCell className="text-right">{l.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 text-right"
                        value={linePrices[l.id]?.unit_price || 0}
                        onChange={e => setLinePrices(prev => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], unit_price: parseFloat(e.target.value) || 0, notes: prev[l.id]?.notes || '' },
                        }))}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₦{((linePrices[l.id]?.unit_price || 0) * l.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-32"
                        value={linePrices[l.id]?.notes || ''}
                        onChange={e => setLinePrices(prev => ({
                          ...prev,
                          [l.id]: { ...prev[l.id], notes: e.target.value, unit_price: prev[l.id]?.unit_price || 0 },
                        }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right font-semibold">
              Total: ₦{active?.lines?.reduce((s: number, l: any) => s + (linePrices[l.id]?.unit_price || 0) * l.quantity, 0).toLocaleString()}
            </div>
            <div className="space-y-2">
              <Label>Cover Notes (optional)</Label>
              <Textarea value={headerNotes} onChange={e => setHeaderNotes(e.target.value)} rows={2} placeholder="Delivery terms, validity, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? 'Submitting...' : 'Submit Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

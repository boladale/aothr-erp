import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Send } from 'lucide-react';

interface Props {
  vendorId: string;
  userId: string;
}

export function VendorRFPBidding({ vendorId, userId }: Props) {
  const queryClient = useQueryClient();
  const [bidDialog, setBidDialog] = useState<{ open: boolean; rfp: any | null }>({ open: false, rfp: null });
  const [coverLetter, setCoverLetter] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [lineItems, setLineItems] = useState<{ rfp_item_id: string; unit_price: number; quantity: number }[]>([]);

  // Get RFPs where vendor has proposals OR RFP is published
  const { data: rfps = [], isLoading } = useQuery({
    queryKey: ['vendor-rfps', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfps')
        .select('*, rfp_proposals(id, status, total_amount, vendor_id)')
        .in('status', ['published', 'evaluating', 'awarded'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((rfp: any) => ({
        ...rfp,
        my_proposal: rfp.rfp_proposals?.find((p: any) => p.vendor_id === vendorId),
      }));
    },
    enabled: !!vendorId,
  });

  const openBidDialog = async (rfp: any) => {
    // Load RFP items
    const { data: items } = await supabase
      .from('rfp_items')
      .select('*, items(item_code, description)')
      .eq('rfp_id', rfp.id);
    
    setBidDialog({ open: true, rfp: { ...rfp, rfp_items: items || [] } });
    setLineItems((items || []).map((item: any) => ({
      rfp_item_id: item.id,
      unit_price: 0,
      quantity: item.quantity,
    })));
    setCoverLetter('');
    setDeliveryDays(30);
  };

  const submitBid = useMutation({
    mutationFn: async () => {
      const totalAmount = lineItems.reduce((s, l) => s + (l.unit_price * l.quantity), 0);
      
      const { data: proposal, error } = await supabase.from('rfp_proposals').insert({
        rfp_id: bidDialog.rfp.id,
        vendor_id: vendorId,
        cover_letter: coverLetter,
        delivery_timeline_days: deliveryDays,
        total_amount: totalAmount,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      } as any).select().single();
      if (error) throw error;

      // Insert proposal lines
      const lines = lineItems.map((l) => ({
        proposal_id: proposal.id,
        rfp_item_id: l.rfp_item_id,
        unit_price: l.unit_price,
        quantity: l.quantity,
        line_total: l.unit_price * l.quantity,
        delivery_days: deliveryDays,
      }));
      const { error: lineError } = await supabase.from('rfp_proposal_lines').insert(lines as any);
      if (lineError) throw lineError;
    },
    onSuccess: () => {
      toast.success('Proposal submitted successfully!');
      setBidDialog({ open: false, rfp: null });
      queryClient.invalidateQueries({ queryKey: ['vendor-rfps'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to submit proposal'),
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RFP #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>My Proposal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rfps.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No RFPs available</TableCell></TableRow>
            ) : rfps.map((rfp: any) => (
              <TableRow key={rfp.id}>
                <TableCell className="font-mono">{rfp.rfp_number}</TableCell>
                <TableCell>{rfp.title}</TableCell>
                <TableCell>{rfp.deadline ? format(new Date(rfp.deadline), 'dd MMM yyyy') : '-'}</TableCell>
                <TableCell><StatusBadge status={rfp.status} /></TableCell>
                <TableCell>
                  {rfp.my_proposal ? (
                    <StatusBadge status={rfp.my_proposal.status} />
                  ) : (
                    <span className="text-muted-foreground text-sm">Not submitted</span>
                  )}
                </TableCell>
                <TableCell>
                  {rfp.status === 'published' && !rfp.my_proposal && (
                    <Button size="sm" onClick={() => openBidDialog(rfp)}>
                      <Send className="h-4 w-4 mr-1" /> Submit Bid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={bidDialog.open} onOpenChange={(o) => { if (!o) setBidDialog({ open: false, rfp: null }); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Proposal - {bidDialog.rfp?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cover Letter / Notes</Label>
              <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Describe your proposal..." rows={3} />
            </div>
            <div>
              <Label>Delivery Timeline (days)</Label>
              <Input type="number" value={deliveryDays} onChange={(e) => setDeliveryDays(Number(e.target.value))} min={1} />
            </div>

            {bidDialog.rfp?.rfp_items?.length > 0 && (
              <div>
                <Label className="mb-2 block">Line Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidDialog.rfp.rfp_items.map((item: any, idx: number) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.items?.description || item.items?.item_code || 'Item'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-28"
                            value={lineItems[idx]?.unit_price || 0}
                            onChange={(e) => {
                              const updated = [...lineItems];
                              updated[idx] = { ...updated[idx], unit_price: Number(e.target.value) };
                              setLineItems(updated);
                            }}
                            min={0}
                            step={0.01}
                          />
                        </TableCell>
                        <TableCell className="font-mono">
                          {((lineItems[idx]?.unit_price || 0) * (lineItems[idx]?.quantity || 0)).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-right font-semibold mt-2">
                  Total: {lineItems.reduce((s, l) => s + (l.unit_price * l.quantity), 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialog({ open: false, rfp: null })}>Cancel</Button>
            <Button onClick={() => submitBid.mutate()} disabled={submitBid.isPending}>Submit Proposal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

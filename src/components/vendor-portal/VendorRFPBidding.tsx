import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Send, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Milestone = { description: string; type: 'percent' | 'amount'; value: number };

interface Props {
  vendorId: string;
  userId: string;
}

export function VendorRFPBidding({ vendorId, userId }: Props) {
  const queryClient = useQueryClient();
  const [bidDialog, setBidDialog] = useState<{ open: boolean; rfp: any | null; proposalId: string | null }>({ open: false, rfp: null, proposalId: null });
  const [coverLetter, setCoverLetter] = useState('');
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [lineItems, setLineItems] = useState<{ rfp_item_id: string; unit_price: number; quantity: number }[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const totalQuote = lineItems.reduce((s, l) => s + (l.unit_price * l.quantity), 0);
  const milestonesTotal = milestones.reduce((s, m) => {
    const v = Number(m.value) || 0;
    return s + (m.type === 'percent' ? (totalQuote * v) / 100 : v);
  }, 0);
  const milestonesPercent = totalQuote > 0 ? (milestonesTotal / totalQuote) * 100 : 0;
  const milestonesOver = milestonesTotal > totalQuote + 0.001;

  // Only RFPs the vendor was invited to (i.e. has a proposal row).
  const { data: rfps = [], isLoading } = useQuery({
    queryKey: ['vendor-invited-rfps', vendorId],
    queryFn: async () => {
      const { data: myProposals, error: pErr } = await supabase
        .from('rfp_proposals')
        .select('id, status, total_amount, rfp_id')
        .eq('vendor_id', vendorId);
      if (pErr) throw pErr;
      const rfpIds = (myProposals || []).map((p: any) => p.rfp_id);
      if (rfpIds.length === 0) return [];

      const { data: rfpRows, error: rErr } = await supabase
        .from('rfps')
        .select('*')
        .in('id', rfpIds)
        .order('created_at', { ascending: false });
      if (rErr) throw rErr;

      const proposalByRfp = new Map((myProposals as any[]).map((p) => [p.rfp_id, p]));
      return (rfpRows || []).map((r: any) => ({ ...r, my_proposal: proposalByRfp.get(r.id) }));
    },
    enabled: !!vendorId,
  });

  const openBidDialog = async (rfp: any) => {
    const { data: items } = await supabase
      .from('rfp_items')
      .select('*, items(code, name), services(code, name)')
      .eq('rfp_id', rfp.id);
    setBidDialog({ open: true, rfp: { ...rfp, rfp_items: items || [] }, proposalId: rfp.my_proposal?.id || null });
    setLineItems((items || []).map((item: any) => ({
      rfp_item_id: item.id,
      unit_price: 0,
      quantity: item.quantity,
    })));
    setCoverLetter('');
    setDeliveryDays(30);
    setMilestones([]);
  };

  const addMilestone = () => setMilestones([...milestones, { description: '', type: 'percent', value: 0 }]);
  const removeMilestone = (idx: number) => setMilestones(milestones.filter((_, i) => i !== idx));
  const updateMilestone = (idx: number, patch: Partial<Milestone>) => {
    const n = [...milestones]; n[idx] = { ...n[idx], ...patch }; setMilestones(n);
  };

  const submitBid = useMutation({
    mutationFn: async () => {
      const totalAmount = lineItems.reduce((s, l) => s + (l.unit_price * l.quantity), 0);

      // Validate milestones
      if (milestones.length > 0) {
        for (const m of milestones) {
          const v = Number(m.value) || 0;
          if (v <= 0) throw new Error('Each milestone value must be greater than zero');
          if (m.type === 'percent' && v > 100) throw new Error('A milestone percentage cannot exceed 100%');
          if (m.type === 'amount' && totalAmount > 0 && v > totalAmount) {
            throw new Error('A milestone amount cannot exceed the quote total');
          }
        }
        const sum = milestones.reduce((s, m) => {
          const v = Number(m.value) || 0;
          return s + (m.type === 'percent' ? (totalAmount * v) / 100 : v);
        }, 0);
        if (sum > totalAmount + 0.001) {
          throw new Error('Milestones total cannot exceed the quote total (100%)');
        }
      }

      const milestonesPayload = milestones.map((m) => ({
        description: m.description,
        type: m.type,
        value: Number(m.value) || 0,
        amount: m.type === 'percent' ? (totalAmount * (Number(m.value) || 0)) / 100 : (Number(m.value) || 0),
      }));

      let proposalId = bidDialog.proposalId;
      if (proposalId) {
        const { error } = await supabase.from('rfp_proposals').update({
          cover_letter: coverLetter,
          delivery_timeline_days: deliveryDays,
          total_amount: totalAmount,
          payment_milestones: milestonesPayload,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        } as any).eq('id', proposalId);
        if (error) throw error;
        await supabase.from('rfp_proposal_lines').delete().eq('proposal_id', proposalId);
      } else {
        const { data: proposal, error } = await supabase.from('rfp_proposals').insert({
          rfp_id: bidDialog.rfp.id,
          vendor_id: vendorId,
          cover_letter: coverLetter,
          delivery_timeline_days: deliveryDays,
          total_amount: totalAmount,
          payment_milestones: milestonesPayload,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        } as any).select().single();
        if (error) throw error;
        proposalId = proposal.id;
      }

      const lines = lineItems.map((l) => ({
        proposal_id: proposalId!,
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
      setBidDialog({ open: false, rfp: null, proposalId: null });
      queryClient.invalidateQueries({ queryKey: ['vendor-invited-rfps'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to submit proposal'),
  });

  const labelFor = (item: any) => {
    if (item.services) return `${item.services.code} - ${item.services.name}`;
    if (item.items) return `${item.items.code} - ${item.items.name}`;
    return 'Unknown';
  };

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
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">You have not been invited to any RFPs yet.</TableCell></TableRow>
            ) : rfps.map((rfp: any) => {
              const canBid = ['published', 'evaluating'].includes(rfp.status) && rfp.my_proposal?.status === 'invited';
              return (
                <TableRow key={rfp.id}>
                  <TableCell className="font-mono">{rfp.rfp_number}</TableCell>
                  <TableCell>{rfp.title}</TableCell>
                  <TableCell>{rfp.deadline ? format(new Date(rfp.deadline), 'dd MMM yyyy') : '-'}</TableCell>
                  <TableCell><StatusBadge status={rfp.status} /></TableCell>
                  <TableCell>
                    {rfp.my_proposal ? <StatusBadge status={rfp.my_proposal.status} /> : <Badge variant="outline">Invited</Badge>}
                  </TableCell>
                  <TableCell>
                    {canBid && (
                      <Button size="sm" onClick={() => openBidDialog(rfp)}>
                        <Send className="h-4 w-4 mr-1" /> Submit Bid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={bidDialog.open} onOpenChange={(o) => { if (!o) setBidDialog({ open: false, rfp: null, proposalId: null }); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Proposal - {bidDialog.rfp?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {bidDialog.rfp?.description && (
              <div className="rounded-md border bg-muted/40 p-3">
                <Label className="text-xs uppercase text-muted-foreground">RFP Description</Label>
                <p className="text-sm whitespace-pre-wrap mt-1">{bidDialog.rfp.description}</p>
              </div>
            )}
            {bidDialog.rfp?.payment_terms && (
              <div className="rounded-md border bg-muted/40 p-3">
                <Label className="text-xs uppercase text-muted-foreground">Expected Payment Terms</Label>
                <p className="text-sm whitespace-pre-wrap mt-1">{bidDialog.rfp.payment_terms}</p>
              </div>
            )}
            <div>
              <Label>Cover Letter / Notes</Label>
              <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={3} />
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
                      <TableHead>Type</TableHead>
                      <TableHead>Item / Service</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidDialog.rfp.rfp_items.map((item: any, idx: number) => (
                      <TableRow key={item.id}>
                        <TableCell><Badge variant={item.services ? 'secondary' : 'outline'}>{item.services ? 'Service' : 'Item'}</Badge></TableCell>
                        <TableCell>{labelFor(item)}</TableCell>
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
            <Button variant="outline" onClick={() => setBidDialog({ open: false, rfp: null, proposalId: null })}>Cancel</Button>
            <Button onClick={() => submitBid.mutate()} disabled={submitBid.isPending}>Submit Proposal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

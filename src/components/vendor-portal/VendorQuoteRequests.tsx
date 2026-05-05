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
  const [paymentTermsType, setPaymentTermsType] = useState<'full_on_delivery' | 'upfront_balance' | 'milestones' | 'net_terms' | 'custom'>('full_on_delivery');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [milestoneMode, setMilestoneMode] = useState<'percentage' | 'amount'>('percentage');
  const [milestones, setMilestones] = useState<Array<{ percentage: number; amount: number; description: string }>>([
    { percentage: 50, amount: 0, description: '' },
    { percentage: 50, amount: 0, description: '' },
  ]);

  const addMilestone = () => setMilestones(m => [...m, { percentage: 0, amount: 0, description: '' }]);
  const removeMilestone = (i: number) => setMilestones(m => m.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: 'percentage' | 'amount' | 'description', val: any) =>
    setMilestones(m => m.map((ms, idx) => idx === i ? { ...ms, [field]: field === 'description' ? val : (parseFloat(val) || 0) } : ms));
  const milestonePctTotal = milestones.reduce((s, m) => s + (m.percentage || 0), 0);
  const milestoneAmtTotal = milestones.reduce((s, m) => s + (m.amount || 0), 0);

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
    // seed payment terms from invitation if present
    const existingMs = (inv as any).payment_milestones;
    if (Array.isArray(existingMs) && existingMs.length > 0) {
      setPaymentTermsType('milestones');
      setMilestones(existingMs);
    } else if ((inv as any).payment_terms) {
      setPaymentTermsType('custom');
      setMilestones([{ percentage: 50, amount: 0, description: '' }, { percentage: 50, amount: 0, description: '' }]);
    } else {
      setPaymentTermsType('full_on_delivery');
      setMilestones([{ percentage: 50, amount: 0, description: '' }, { percentage: 50, amount: 0, description: '' }]);
    }
    setPaymentTerms((inv as any).payment_terms || '');
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
      // build payment terms text
      let termsText = '';
      let msJson: any = null;
      if (paymentTermsType === 'full_on_delivery') termsText = '100% on delivery';
      else if (paymentTermsType === 'upfront_balance') termsText = '50% upfront, 50% after delivery';
      else if (paymentTermsType === 'net_terms') termsText = paymentTerms || 'Net 30';
      else if (paymentTermsType === 'custom') termsText = paymentTerms;
      else if (paymentTermsType === 'milestones') {
        const totalCost = active.lines.reduce((s: number, l: any) => s + (linePrices[l.id]?.unit_price || 0) * l.quantity, 0);
        if (milestoneMode === 'percentage') {
          if (Math.round(milestonePctTotal) !== 100) throw new Error('Milestone percentages must total 100%');
          msJson = milestones.map(m => ({ ...m, amount: +(totalCost * (m.percentage || 0) / 100).toFixed(2) }));
          termsText = milestones.map(m => `${m.percentage}% — ${m.description || 'milestone'}`).join('; ');
        } else {
          if (Math.abs(milestoneAmtTotal - totalCost) > 0.01) throw new Error(`Milestone amounts must total ₦${totalCost.toLocaleString()}`);
          msJson = milestones.map(m => ({ ...m, percentage: totalCost ? +((m.amount || 0) / totalCost * 100).toFixed(2) : 0 }));
          termsText = milestones.map(m => `₦${(m.amount || 0).toLocaleString()} — ${m.description || 'milestone'}`).join('; ');
        }
      }
      // mark invitation as quoted with payment terms
      await (supabase.from('bid_invitations' as any)
        .update({ status: 'quoted', responded_at: new Date().toISOString(), payment_terms: termsText, payment_milestones: msJson })
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
            <div className="space-y-2 border-t pt-4">
              <Label className="text-base font-semibold">Payment Terms</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentTermsType}
                onChange={e => setPaymentTermsType(e.target.value as any)}
              >
                <option value="full_on_delivery">100% on delivery</option>
                <option value="upfront_balance">50% upfront, 50% after delivery</option>
                <option value="milestones">Milestone payments</option>
                <option value="net_terms">Net terms (Net 30, Net 60, etc.)</option>
                <option value="custom">Custom</option>
              </select>

              {paymentTermsType === 'milestones' && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        type="number"
                        className="w-20"
                        value={m.percentage}
                        onChange={e => updateMilestone(i, 'percentage', e.target.value)}
                        placeholder="%"
                      />
                      <span className="text-sm">%</span>
                      <Input
                        className="flex-1"
                        value={m.description}
                        onChange={e => updateMilestone(i, 'description', e.target.value)}
                        placeholder="Milestone description (e.g. On signing, On delivery)"
                      />
                      {milestones.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeMilestone(i)}>×</Button>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <Button type="button" variant="outline" size="sm" onClick={addMilestone}>+ Add milestone</Button>
                    <span className={`text-sm font-medium ${milestoneTotal === 100 ? 'text-green-600' : 'text-destructive'}`}>
                      Total: {milestoneTotal}% {milestoneTotal !== 100 && '(must equal 100%)'}
                    </span>
                  </div>
                </div>
              )}

              {(paymentTermsType === 'net_terms' || paymentTermsType === 'custom') && (
                <Textarea
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  rows={2}
                  placeholder={paymentTermsType === 'net_terms' ? 'e.g. Net 30 days from invoice date' : 'Describe your payment terms'}
                />
              )}
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

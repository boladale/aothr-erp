import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface RFPItemLite {
  id: string;
  quantity: number;
  specifications: string | null;
  items: { code: string; name: string } | null;
  services: { code: string; name: string } | null;
}

interface ProposalLite {
  id: string;
  vendor_id: string;
  status: string;
  total_amount: number;
  delivery_timeline_days: number | null;
  vendors: { code: string; name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rfpId: string;
  rfqNumber: string;
  items: RFPItemLite[];
  proposals: ProposalLite[];
  readOnly?: boolean;
  onSaved?: () => void;
}

export function QuoteComparisonDialog({
  open, onOpenChange, rfqNumber, items, proposals, readOnly, onSaved,
}: Props) {
  // prices[proposalId][rfpItemId] = unit price
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [days, setDays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || proposals.length === 0) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('rfp_proposal_lines')
        .select('proposal_id, rfp_item_id, unit_price')
        .in('proposal_id', proposals.map(p => p.id));
      if (error) toast.error('Could not load quoted line prices');
      const map: Record<string, Record<string, number>> = {};
      proposals.forEach(p => { map[p.id] = {}; });
      (data || []).forEach((l: any) => {
        if (!map[l.proposal_id]) map[l.proposal_id] = {};
        map[l.proposal_id][l.rfp_item_id] = Number(l.unit_price) || 0;
      });
      setPrices(map);
      const d: Record<string, string> = {};
      proposals.forEach(p => { d[p.id] = p.delivery_timeline_days?.toString() || ''; });
      setDays(d);
      setLoading(false);
    })();
  }, [open, proposals]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    proposals.forEach(p => {
      t[p.id] = items.reduce(
        (s, it) => s + (Number(prices[p.id]?.[it.id]) || 0) * (Number(it.quantity) || 0),
        0,
      );
    });
    return t;
  }, [prices, items, proposals]);

  const lowestTotal = useMemo(() => {
    const vals = proposals.map(p => totals[p.id]).filter(v => v > 0);
    return vals.length ? Math.min(...vals) : 0;
  }, [totals, proposals]);

  const fastest = useMemo(() => {
    const vals = proposals.map(p => Number(days[p.id])).filter(v => v > 0);
    return vals.length ? Math.min(...vals) : 0;
  }, [days, proposals]);

  const label = (it: RFPItemLite) =>
    it.items ? `${it.items.code} — ${it.items.name}` : it.services ? `${it.services.code} — ${it.services.name}` : 'Item';

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const p of proposals) {
        await supabase.from('rfp_proposal_lines').delete().eq('proposal_id', p.id);
        const rows = items
          .map(it => ({
            proposal_id: p.id,
            rfp_item_id: it.id,
            quantity: Number(it.quantity) || 0,
            unit_price: Number(prices[p.id]?.[it.id]) || 0,
            line_total: (Number(prices[p.id]?.[it.id]) || 0) * (Number(it.quantity) || 0),
          }))
          .filter(r => r.unit_price > 0);
        if (rows.length) {
          const { error } = await supabase.from('rfp_proposal_lines').insert(rows);
          if (error) throw error;
        }
        const dayVal = days[p.id] ? Number(days[p.id]) : null;
        const { error: upErr } = await supabase
          .from('rfp_proposals')
          .update({
            total_amount: totals[p.id] || 0,
            delivery_timeline_days: dayVal,
            status: totals[p.id] > 0 && p.status === 'invited' ? 'submitted' : p.status,
            submitted_at: totals[p.id] > 0 ? new Date().toISOString() : null,
          })
          .eq('id', p.id);
        if (upErr) throw upErr;
      }
      toast.success('Quote comparison saved');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save quotes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Line-by-Line Quote Comparison — {rfqNumber}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter each vendor's unit price per line item. Totals are added up automatically and ranked on price and delivery time.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Line Item</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                {proposals.map(p => (
                  <TableHead key={p.id} className="min-w-[150px]">{p.vendors?.name || 'Vendor'}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    {label(it)}
                    {it.specifications && <p className="text-xs text-muted-foreground">{it.specifications}</p>}
                  </TableCell>
                  <TableCell>{Number(it.quantity).toLocaleString()}</TableCell>
                  {proposals.map(p => {
                    const unit = Number(prices[p.id]?.[it.id]) || 0;
                    return (
                      <TableCell key={p.id}>
                        {readOnly ? (
                          <div>
                            <div>{formatCurrency(unit)}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(unit * (Number(it.quantity) || 0))}</div>
                          </div>
                        ) : (
                          <div>
                            <Input
                              type="number"
                              className="w-32"
                              value={prices[p.id]?.[it.id] ?? ''}
                              placeholder="Unit price"
                              onChange={e =>
                                setPrices(prev => ({
                                  ...prev,
                                  [p.id]: { ...(prev[p.id] || {}), [it.id]: Number(e.target.value) },
                                }))
                              }
                            />
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(unit * (Number(it.quantity) || 0))}
                            </div>
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={2 + proposals.length} className="text-center text-muted-foreground">No line items on this RFQ.</TableCell></TableRow>
              )}

              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold" colSpan={2}>Total Quoted Price</TableCell>
                {proposals.map(p => (
                  <TableCell key={p.id} className="font-semibold">
                    {formatCurrency(totals[p.id] || 0)}
                    {totals[p.id] > 0 && totals[p.id] === lowestTotal && (
                      <Badge variant="outline" className="ml-2 text-green-600">Lowest</Badge>
                    )}
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell className="font-semibold" colSpan={2}>Delivery Time (days)</TableCell>
                {proposals.map(p => (
                  <TableCell key={p.id}>
                    {readOnly ? (
                      <span>{days[p.id] || '-'}</span>
                    ) : (
                      <Input
                        type="number"
                        className="w-24"
                        value={days[p.id] ?? ''}
                        onChange={e => setDays(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    )}
                    {Number(days[p.id]) > 0 && Number(days[p.id]) === fastest && (
                      <Badge variant="outline" className="ml-2 text-green-600">Fastest</Badge>
                    )}
                  </TableCell>
                ))}
              </TableRow>

              <TableRow className="bg-muted/30">
                <TableCell className="font-semibold" colSpan={2}>Difference vs Lowest</TableCell>
                {proposals.map(p => {
                  const diff = (totals[p.id] || 0) - lowestTotal;
                  return (
                    <TableCell key={p.id} className={diff > 0 ? 'text-destructive' : 'text-green-600'}>
                      {totals[p.id] > 0 ? (diff > 0 ? `+${formatCurrency(diff)}` : '—') : '-'}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Quotes & Totals
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

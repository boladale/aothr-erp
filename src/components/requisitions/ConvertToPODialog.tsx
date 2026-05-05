import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award } from 'lucide-react';

interface ReqLine {
  id: string;
  line_number: number;
  item_id: string | null;
  service_id: string | null;
  quantity: number;
  estimated_unit_cost: number;
  qty_converted: number;
  specifications: string | null;
  items: { code: string; name: string; unit_of_measure: string } | null;
  services: { code: string; name: string } | null;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition: { id: string; req_number: string };
  lines: ReqLine[];
  onSuccess: () => void;
}

interface SelectedLine {
  requisition_line_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  selected: boolean;
}

interface AwardedBidInfo {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  /** Map of requisition_line_id -> { unit_price, quantity } */
  linePrices: Record<string, { unit_price: number; quantity: number }>;
}

export function ConvertToPODialog({ open, onOpenChange, requisition, lines, onSuccess }: Props) {
  const { user, organizationId } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [awardedInfo, setAwardedInfo] = useState<AwardedBidInfo | null>(null);

  useEffect(() => {
    if (!open) return;

    // Fetch vendors, locations, and check for awarded/recommended bid
    const loadData = async () => {
      const [vRes, lRes] = await Promise.all([
        supabase.from('vendors').select('id, code, name').eq('status', 'active').order('name'),
        supabase.from('locations').select('id, code, name').eq('is_active', true).order('name'),
      ]);
      setVendors((vRes.data || []) as Vendor[]);
      setLocations((lRes.data || []) as Location[]);

      // Check for recommended vendor from bid entries
      const { data: bidRequests } = await supabase
        .from('requisition_bid_requests')
        .select('id')
        .eq('requisition_id', requisition.id);

      let awarded: AwardedBidInfo | null = null;

      if (bidRequests && bidRequests.length > 0) {
        const bidRequestIds = bidRequests.map(br => br.id);
        const { data: recommendedEntries } = await supabase
          .from('requisition_bid_entries')
          .select('vendor_id, requisition_line_id, unit_price, quantity')
          .in('bid_request_id', bidRequestIds)
          .eq('is_recommended', true);

        if (recommendedEntries && recommendedEntries.length > 0) {
          const recVendorId = recommendedEntries[0].vendor_id;
          // Get vendor info
          const vendor = (vRes.data || []).find((v: any) => v.id === recVendorId);

          const linePrices: Record<string, { unit_price: number; quantity: number }> = {};
          for (const entry of recommendedEntries) {
            linePrices[entry.requisition_line_id] = {
              unit_price: entry.unit_price,
              quantity: entry.quantity,
            };
          }

          awarded = {
            vendorId: recVendorId,
            vendorName: vendor?.name || 'Unknown',
            vendorCode: vendor?.code || '',
            linePrices,
          };
        }
      }

      setAwardedInfo(awarded);

      // Set vendor (lock to awarded if exists)
      if (awarded) {
        setVendorId(awarded.vendorId);
      } else {
        setVendorId('');
      }

      // Build selected lines with awarded prices if available
      setSelectedLines(lines.map(l => {
        const available = l.quantity - l.qty_converted;
        const bidLine = awarded?.linePrices[l.id];
        return {
          requisition_line_id: l.id,
          item_id: l.item_id,
          quantity: bidLine ? Math.min(bidLine.quantity, available) : available,
          unit_price: bidLine ? bidLine.unit_price : l.estimated_unit_cost,
          selected: true,
        };
      }));
    };

    loadData();
    setExpectedDate('');
    setLocationId('');
  }, [open, lines, requisition.id]);

  const toggleLine = (idx: number) => {
    const updated = [...selectedLines];
    updated[idx].selected = !updated[idx].selected;
    setSelectedLines(updated);
  };

  const updateLineField = (idx: number, field: 'quantity' | 'unit_price', value: number) => {
    const updated = [...selectedLines];
    updated[idx][field] = value;
    setSelectedLines(updated);
  };

  const handleConvert = async () => {
    if (!vendorId) { toast.error('Select a vendor'); return; }

    const linesToConvert = selectedLines.filter(l => l.selected && l.quantity > 0);
    if (linesToConvert.length === 0) { toast.error('Select at least one line'); return; }

    setSaving(true);
    try {
      const poNumber = await getNextTransactionNumber(organizationId!, 'PO', 'PO');
      const subtotal = linesToConvert.reduce((s, l) => s + l.quantity * l.unit_price, 0);

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          vendor_id: vendorId,
          ship_to_location_id: locationId || null,
          expected_date: expectedDate || null,
          subtotal,
          total_amount: subtotal,
          notes: `Converted from ${requisition.req_number}`,
          requisition_id: requisition.id,
          created_by: user?.id, organization_id: organizationId,
        })
        .select()
        .single();

      if (poError) throw poError;

      const poLines = linesToConvert.map((l, idx) => {
        const reqLine = lines.find(rl => rl.id === l.requisition_line_id);
        const description = reqLine?.items
          ? reqLine.items.name
          : reqLine?.services
          ? reqLine.services.name
          : null;
        return {
          po_id: po.id,
          line_number: idx + 1,
          item_id: reqLine?.item_id || null,
          service_id: reqLine?.service_id || null,
          description,
          quantity: l.quantity,
          unit_price: l.unit_price,
        } as any;
      });

      const { data: insertedLines, error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(poLines)
        .select();

      if (linesError) throw linesError;

      const traceLinks = (insertedLines || []).map((poLine, idx) => ({
        po_line_id: poLine.id,
        requisition_line_id: linesToConvert[idx].requisition_line_id,
        quantity: linesToConvert[idx].quantity,
      }));

      const { error: traceError } = await supabase
        .from('po_line_requisition_lines')
        .insert(traceLinks);

      if (traceError) throw traceError;

      toast.success(`PO ${poNumber} created from requisition`);
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert');
    } finally {
      setSaving(false);
    }
  };

  const total = selectedLines.filter(l => l.selected).reduce((s, l) => s + l.quantity * l.unit_price, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert {requisition.req_number} to Purchase Order</DialogTitle>
        </DialogHeader>

        {awardedInfo && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Awarded Vendor: {awardedInfo.vendorCode} - {awardedInfo.vendorName}
            </span>
            <Badge variant="secondary" className="ml-auto">Recommended</Badge>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              {awardedInfo ? (
                <Input
                  value={`${awardedInfo.vendorCode} - ${awardedInfo.vendorName}`}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ship To</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Lines to Convert</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {awardedInfo && <TableHead className="text-center">Source</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLines.map((sl, idx) => {
                  const reqLine = lines[idx];
                  const hasBidPrice = awardedInfo?.linePrices[sl.requisition_line_id];
                  return (
                    <TableRow key={sl.requisition_line_id}>
                      <TableCell>
                        <Checkbox checked={sl.selected} onCheckedChange={() => toggleLine(idx)} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {reqLine?.items
                          ? `${reqLine.items.code} - ${reqLine.items.name}`
                          : reqLine?.services
                          ? `${reqLine.services.code} - ${reqLine.services.name}`
                          : '-'}
                        {reqLine?.specifications && (
                          <div className="text-xs text-muted-foreground mt-1">{reqLine.specifications}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{reqLine ? reqLine.quantity - reqLine.qty_converted : 0}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="1"
                          max={reqLine ? reqLine.quantity - reqLine.qty_converted : 0}
                          className="w-20 text-right"
                          value={sl.quantity}
                          onChange={e => updateLineField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          disabled={!sl.selected}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-24 text-right"
                          value={sl.unit_price}
                          onChange={e => updateLineField(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          disabled={!sl.selected}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₦{(sl.selected ? sl.quantity * sl.unit_price : 0).toFixed(2)}
                      </TableCell>
                      {awardedInfo && (
                        <TableCell className="text-center">
                          {hasBidPrice ? (
                            <Badge variant="outline" className="text-xs border-primary/50 text-primary">Bid</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Est.</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="text-right font-semibold">PO Total: ₦{total.toFixed(2)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={saving}>
            {saving ? 'Converting...' : 'Create Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

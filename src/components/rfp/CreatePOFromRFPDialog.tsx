import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { PODocumentDialog } from '@/components/purchase-orders/PODocumentDialog';
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
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Package, Clock, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface RFPItem {
  id: string;
  item_id: string | null;
  service_id: string | null;
  quantity: number;
  specifications: string | null;
  items: { code: string; name: string; unit_of_measure: string } | null;
  services: { code: string; name: string } | null;
}

interface AwardedProposal {
  id: string;
  vendor_id: string;
  total_amount: number;
  delivery_timeline_days: number | null;
  vendors: { code: string; name: string } | null;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfpId: string;
  rfpNumber: string;
  rfpTitle: string;
  awardedProposal: AwardedProposal;
  rfpItems: RFPItem[];
  onSuccess: () => void;
}

interface POLine {
  item_id: string | null;
  service_id: string | null;
  quantity: number;
  unit_price: number;
  itemCode: string;
  itemName: string;
  kind: 'item' | 'service';
}

export function CreatePOFromRFPDialog({ open, onOpenChange, rfpId, rfpNumber, rfpTitle, awardedProposal, rfpItems, onSuccess }: Props) {
  const { user, organizationId } = useAuth();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [poLines, setPOLines] = useState<POLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [createdPOId, setCreatedPOId] = useState<string | null>(null);
  const [showDocument, setShowDocument] = useState(false);

  useEffect(() => {
    if (!open) return;

    supabase.from('locations').select('id, code, name').eq('is_active', true).order('name')
      .then(({ data }) => setLocations((data || []) as Location[]));

    const totalQty = rfpItems.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = awardedProposal.total_amount || 0;

    const lines: POLine[] = rfpItems.map(item => {
      const isService = !!item.service_id;
      const ref = isService ? item.services : item.items;
      return {
        item_id: isService ? null : item.item_id,
        service_id: isService ? item.service_id : null,
        kind: isService ? 'service' : 'item',
        quantity: item.quantity,
        unit_price: totalQty > 0 ? Math.round((totalAmount / totalQty) * 100) / 100 : 0,
        itemCode: ref?.code || '',
        itemName: ref?.name || '',
      };
    });
    setPOLines(lines);

    // Pre-fill expected date from delivery timeline
    if (awardedProposal.delivery_timeline_days) {
      const d = new Date();
      d.setDate(d.getDate() + awardedProposal.delivery_timeline_days);
      setExpectedDate(d.toISOString().split('T')[0]);
    } else {
      setExpectedDate('');
    }
    setLocationId('');
  }, [open, rfpItems, awardedProposal]);

  const updateLineField = (idx: number, field: 'quantity' | 'unit_price', value: number) => {
    const updated = [...poLines];
    updated[idx][field] = value;
    setPOLines(updated);
  };

  const total = poLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const handleCreate = async () => {
    if (poLines.length === 0) { toast.error('No items to convert'); return; }
    setSaving(true);
    let createdPoIdForRollback: string | null = null;

    try {
      const poNumber = await getNextTransactionNumber(organizationId!, 'PO', 'PO');
      const subtotal = poLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

      // Fetch RFP payment terms to carry over
      const { data: rfpRow } = await supabase
        .from('rfps')
        .select('payment_terms')
        .eq('id', rfpId)
        .single();

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          vendor_id: awardedProposal.vendor_id,
          ship_to_location_id: locationId || null,
          expected_date: expectedDate || null,
          subtotal,
          total_amount: subtotal,
          payment_terms: (rfpRow as any)?.payment_terms || null,
          notes: `Created from RFP ${rfpNumber} — ${rfpTitle}`,
          created_by: user?.id,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (poError) throw poError;

      createdPoIdForRollback = po.id;

      const poLineInserts = poLines.map((l, idx) => ({
        po_id: po.id,
        line_number: idx + 1,
        item_id: l.item_id,
        service_id: l.service_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })) as any;

      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(poLineInserts);

      if (linesError) {
        await supabase.from('purchase_orders').delete().eq('id', po.id);
        throw linesError;
      }

      toast.success(`PO ${poNumber} created from RFP`);
      setCreatedPOId(po.id);
      onOpenChange(false);
      onSuccess();
      setShowDocument(true);
    } catch (error: unknown) {
      if (createdPoIdForRollback) {
        await supabase.from('purchase_orders').delete().eq('id', createdPoIdForRollback);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to create PO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order from {rfpNumber}</DialogTitle>
        </DialogHeader>

        {/* Awarded Vendor Banner */}
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <Award className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="font-semibold">{awardedProposal.vendors?.code} — {awardedProposal.vendors?.name}</p>
            <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> Quoted: <strong className="text-foreground">{formatCurrency(awardedProposal.total_amount)}</strong>
              </span>
              {awardedProposal.delivery_timeline_days && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Delivery: <strong className="text-foreground">{awardedProposal.delivery_timeline_days} days</strong>
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary">Awarded</Badge>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ship To Location</Label>
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
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
              {awardedProposal.delivery_timeline_days && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Auto-set from {awardedProposal.delivery_timeline_days}-day delivery timeline
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>PO Line Items</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poLines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{line.itemCode} — {line.itemName}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="1"
                        className="w-20 text-right"
                        value={line.quantity}
                        onChange={e => updateLineField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 text-right"
                        value={line.unit_price}
                        onChange={e => updateLineField(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.quantity * line.unit_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right font-semibold text-lg">PO Total: {formatCurrency(total)}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {createdPOId && (
      <PODocumentDialog
        open={showDocument}
        onOpenChange={(open) => {
          setShowDocument(open);
          if (!open) {
            navigate(`/purchase-orders/${createdPOId}`);
          }
        }}
        poId={createdPOId}
      />
    )}
    </>
  );
}

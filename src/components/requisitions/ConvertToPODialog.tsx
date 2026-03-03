import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ReqLine {
  id: string;
  line_number: number;
  item_id: string;
  quantity: number;
  estimated_unit_cost: number;
  qty_converted: number;
  items: { code: string; name: string; unit_of_measure: string } | null;
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

export function ConvertToPODialog({ open, onOpenChange, requisition, lines, onSuccess }: Props) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([
        supabase.from('vendors').select('id, code, name').eq('status', 'active').order('name'),
        supabase.from('locations').select('id, code, name').eq('is_active', true).order('name'),
      ]).then(([vRes, lRes]) => {
        setVendors((vRes.data || []) as Vendor[]);
        setLocations((lRes.data || []) as Location[]);
      });

      setSelectedLines(lines.map(l => ({
        requisition_line_id: l.id,
        item_id: l.item_id,
        quantity: l.quantity - l.qty_converted,
        unit_price: l.estimated_unit_cost,
        selected: true,
      })));
    }
  }, [open, lines]);

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
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
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
          created_by: user?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Insert PO lines
      const poLines = linesToConvert.map((l, idx) => ({
        po_id: po.id,
        line_number: idx + 1,
        item_id: l.item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }));

      const { data: insertedLines, error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(poLines)
        .select();

      if (linesError) throw linesError;

      // Create traceability links
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
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLines.map((sl, idx) => {
                  const reqLine = lines[idx];
                  return (
                    <TableRow key={sl.requisition_line_id}>
                      <TableCell>
                        <Checkbox checked={sl.selected} onCheckedChange={() => toggleLine(idx)} />
                      </TableCell>
                      <TableCell className="font-medium">{reqLine?.items?.code} - {reqLine?.items?.name}</TableCell>
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

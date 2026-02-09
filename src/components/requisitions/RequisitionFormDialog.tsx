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
import { Textarea } from '@/components/ui/textarea';
import { ClipboardList } from 'lucide-react';

interface Item {
  id: string;
  code: string;
  name: string;
  unit_cost: number | null;
}

interface ReqLine {
  item_id: string;
  quantity: number;
  estimated_unit_cost: number;
  specifications: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequisitionFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department: '',
    justification: '',
    needed_by_date: '',
    notes: '',
  });
  const [lines, setLines] = useState<ReqLine[]>([
    { item_id: '', quantity: 1, estimated_unit_cost: 0, specifications: '' },
  ]);

  useEffect(() => {
    if (open) {
      supabase.from('items').select('id, code, name, unit_cost').eq('is_active', true).order('name')
        .then(({ data }) => setItems((data || []) as Item[]));
    }
  }, [open]);

  const addLine = () => {
    setLines([...lines, { item_id: '', quantity: 1, estimated_unit_cost: 0, specifications: '' }]);
  };

  const updateLine = (idx: number, field: keyof ReqLine, value: string | number) => {
    const newLines = [...lines];
    (newLines[idx] as Record<keyof ReqLine, string | number>)[field] = value;
    if (field === 'item_id') {
      const item = items.find(i => i.id === value);
      if (item) newLines[idx].estimated_unit_cost = item.unit_cost || 0;
    }
    setLines(newLines);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    const validLines = lines.filter(l => l.item_id && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const reqNumber = `REQ-${Date.now().toString(36).toUpperCase()}`;

      const { data: req, error: reqError } = await supabase
        .from('requisitions')
        .insert({
          req_number: reqNumber,
          requester_id: user?.id,
          department: form.department || null,
          justification: form.justification || null,
          needed_by_date: form.needed_by_date || null,
          notes: form.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      const lineInserts = validLines.map((l, idx) => ({
        requisition_id: req.id,
        line_number: idx + 1,
        item_id: l.item_id,
        quantity: l.quantity,
        estimated_unit_cost: l.estimated_unit_cost,
        specifications: l.specifications || null,
      }));

      const { error: linesError } = await supabase.from('requisition_lines').insert(lineInserts);
      if (linesError) throw linesError;

      toast.success('Requisition created');
      onOpenChange(false);
      setForm({ department: '', justification: '', needed_by_date: '', notes: '' });
      setLines([{ item_id: '', quantity: 1, estimated_unit_cost: 0, specifications: '' }]);
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create requisition');
    } finally {
      setSaving(false);
    }
  };

  const totalEstimate = lines.reduce((sum, l) => sum + l.quantity * l.estimated_unit_cost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> New Requisition
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label>Needed By</Label>
              <Input
                type="date"
                value={form.needed_by_date}
                onChange={e => setForm({ ...form, needed_by_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Justification</Label>
            <Textarea
              value={form.justification}
              onChange={e => setForm({ ...form, justification: e.target.value })}
              placeholder="Why is this needed?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={line.item_id} onValueChange={v => updateLine(idx, 'item_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.code} - {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Est. Cost"
                      value={line.estimated_unit_cost}
                      onChange={e => updateLine(idx, 'estimated_unit_cost', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24 text-right font-medium text-sm">
                    ${(line.quantity * line.estimated_unit_cost).toFixed(2)}
                  </div>
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)}>×</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right text-sm font-semibold text-muted-foreground">
              Estimated Total: ${totalEstimate.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Requisition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

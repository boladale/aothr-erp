import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Item {
  id: string;
  code: string;
  name: string;
}

interface RFPFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId?: string;
  organizationId?: string | null;
}

interface RFPItemLine {
  item_id: string;
  quantity: number;
  specifications: string;
}

interface CriterionLine {
  criterion_name: string;
  weight: number;
  description: string;
}

export function RFPFormDialog({ open, onOpenChange, onSuccess, userId, organizationId }: RFPFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [rfpItems, setRfpItems] = useState<RFPItemLine[]>([{ item_id: '', quantity: 1, specifications: '' }]);
  const [criteria, setCriteria] = useState<CriterionLine[]>([
    { criterion_name: 'Price', weight: 25, description: 'Total cost competitiveness' },
    { criterion_name: 'Experience', weight: 25, description: 'Past performance and relevant projects' },
    { criterion_name: 'Delivery Timeline', weight: 25, description: 'Proposed delivery schedule' },
    { criterion_name: 'Quality', weight: 25, description: 'Quality standards and certifications' },
  ]);

  const distributeWeights = (list: CriterionLine[]): CriterionLine[] => {
    if (list.length === 0) return list;
    const base = Math.floor(100 / list.length);
    const remainder = 100 - base * list.length;
    return list.map((c, i) => ({ ...c, weight: base + (i < remainder ? 1 : 0) }));
  };

  const addCriterion = () => {
    const updated = [...criteria, { criterion_name: '', weight: 0, description: '' }];
    setCriteria(distributeWeights(updated));
  };

  const removeCriterion = (idx: number) => {
    const updated = criteria.filter((_, i) => i !== idx);
    setCriteria(distributeWeights(updated));
  };
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('items').select('id, code, name').eq('is_active', true).order('name')
        .then(({ data }) => setItems((data || []) as Item[]));
    }
  }, [open]);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (rfpItems.some(i => !i.item_id || i.quantity <= 0)) { toast.error('All items must be selected with valid quantities'); return; }
    if (totalWeight !== 100) { toast.error('Criteria weights must sum to 100%'); return; }

    setSubmitting(true);
    try {
      const rfpNumber = `RFP-${Date.now().toString(36).toUpperCase()}`;

      const { data: rfp, error: rfpError } = await supabase
        .from('rfps')
        .insert({
          rfp_number: rfpNumber,
          title,
          description: description || null,
          deadline: deadline || null,
          created_by: userId,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (rfpError) throw rfpError;

      // Insert items
      const { error: itemsError } = await supabase.from('rfp_items').insert(
        rfpItems.map(i => ({
          rfp_id: rfp.id,
          item_id: i.item_id,
          quantity: i.quantity,
          specifications: i.specifications || null,
        }))
      );
      if (itemsError) throw itemsError;

      // Insert criteria
      const { error: criteriaError } = await supabase.from('rfp_criteria').insert(
        criteria.map(c => ({
          rfp_id: rfp.id,
          criterion_name: c.criterion_name,
          weight: c.weight,
          description: c.description || null,
        }))
      );
      if (criteriaError) throw criteriaError;

      toast.success('RFP created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create RFP';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDeadline('');
    setRfpItems([{ item_id: '', quantity: 1, specifications: '' }]);
    setCriteria([
      { criterion_name: 'Price', weight: 25, description: 'Total cost competitiveness' },
      { criterion_name: 'Experience', weight: 25, description: 'Past performance and relevant projects' },
      { criterion_name: 'Delivery Timeline', weight: 25, description: 'Proposed delivery schedule' },
      { criterion_name: 'Quality', weight: 25, description: 'Quality standards and certifications' },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New RFP</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Equipment Supply" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the requirements..." rows={3} />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Items Required</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setRfpItems([...rfpItems, { item_id: '', quantity: 1, specifications: '' }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {rfpItems.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select value={line.item_id} onValueChange={v => { const n = [...rfpItems]; n[idx].item_id = v; setRfpItems(n); }}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={1} value={line.quantity} onChange={e => { const n = [...rfpItems]; n[idx].quantity = Number(e.target.value); setRfpItems(n); }} placeholder="Qty" />
                  </div>
                  <div className="col-span-4">
                    <Input value={line.specifications} onChange={e => { const n = [...rfpItems]; n[idx].specifications = e.target.value; setRfpItems(n); }} placeholder="Specifications" />
                  </div>
                  <div className="col-span-1">
                    {rfpItems.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setRfpItems(rfpItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Criteria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Evaluation Criteria (Total: {totalWeight}%)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCriterion}>
                <Plus className="h-3 w-3 mr-1" /> Add Criterion
              </Button>
            </div>
            {totalWeight !== 100 && <p className="text-sm text-destructive mb-2">Weights must sum to 100%</p>}
            <div className="space-y-3">
              {criteria.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Input value={c.criterion_name} onChange={e => { const n = [...criteria]; n[idx].criterion_name = e.target.value; setCriteria(n); }} placeholder="Criterion" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0} max={100} value={c.weight} onChange={e => { const n = [...criteria]; n[idx].weight = Number(e.target.value); setCriteria(n); }} placeholder="Weight %" />
                  </div>
                  <div className="col-span-5">
                    <Input value={c.description} onChange={e => { const n = [...criteria]; n[idx].description = e.target.value; setCriteria(n); }} placeholder="Description" />
                  </div>
                  <div className="col-span-1">
                    {criteria.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setCriteria(criteria.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create RFP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

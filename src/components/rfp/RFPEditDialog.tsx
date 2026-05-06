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

interface Item { id: string; code: string; name: string; }
interface Service { id: string; code: string; name: string; }

interface RFPItemLine {
  id?: string;
  kind: 'item' | 'service';
  item_id: string;
  service_id: string;
  quantity: number;
  specifications: string;
}

interface CriterionLine {
  id?: string;
  criterion_name: string;
  weight: number;
  description: string;
}

interface RFPEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  rfpId: string;
  initialData: {
    title: string;
    description: string | null;
    deadline: string | null;
  };
  initialItems: { id: string; item_id: string | null; service_id?: string | null; quantity: number; specifications: string | null }[];
  initialCriteria: { id: string; criterion_name: string; weight: number; description: string | null }[];
}

export function RFPEditDialog({
  open, onOpenChange, onSuccess, rfpId,
  initialData, initialItems, initialCriteria,
}: RFPEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rfpItems, setRfpItems] = useState<RFPItemLine[]>([]);
  const [criteria, setCriteria] = useState<CriterionLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const distributeWeights = (list: CriterionLine[]): CriterionLine[] => {
    if (list.length === 0) return list;
    const base = Math.floor(100 / list.length);
    const remainder = 100 - base * list.length;
    return list.map((c, i) => ({ ...c, weight: base + (i < remainder ? 1 : 0) }));
  };

  const addCriterion = () => setCriteria(distributeWeights([...criteria, { criterion_name: '', weight: 0, description: '' }]));
  const removeCriterion = (idx: number) => setCriteria(distributeWeights(criteria.filter((_, i) => i !== idx)));

  useEffect(() => {
    if (!open) return;
    setTitle(initialData.title);
    setDescription(initialData.description || '');
    setDeadline(initialData.deadline ? initialData.deadline.slice(0, 16) : '');

    // Load lookups
    supabase.from('items').select('id, code, name').eq('is_active', true).order('name')
      .then(({ data }) => setItems((data || []) as Item[]));
    supabase.from('services').select('id, code, name').eq('is_active', true).order('name')
      .then(({ data }) => setServices((data || []) as Service[]));

    // Always reload current lines & criteria from DB to guarantee freshness
    (async () => {
      const [{ data: itemsData }, { data: criteriaData }] = await Promise.all([
        supabase.from('rfp_items').select('id, item_id, service_id, quantity, specifications').eq('rfp_id', rfpId),
        supabase.from('rfp_criteria').select('id, criterion_name, weight, description').eq('rfp_id', rfpId),
      ]);
      const lines = (itemsData && itemsData.length > 0)
        ? itemsData
        : initialItems;
      setRfpItems((lines || []).map((i: any) => ({
        id: i.id,
        kind: i.service_id ? 'service' : 'item',
        item_id: i.item_id || '',
        service_id: i.service_id || '',
        quantity: Number(i.quantity) || 1,
        specifications: i.specifications || '',
      })));
      const crit = (criteriaData && criteriaData.length > 0) ? criteriaData : initialCriteria;
      setCriteria((crit || []).map((c: any) => ({
        id: c.id,
        criterion_name: c.criterion_name,
        weight: Number(c.weight) || 0,
        description: c.description || '',
      })));
    })();
  }, [open, rfpId]);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const updateLine = (idx: number, patch: Partial<RFPItemLine>) => {
    const n = [...rfpItems]; n[idx] = { ...n[idx], ...patch }; setRfpItems(n);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    for (const l of rfpItems) {
      if (l.kind === 'item' && !l.item_id) { toast.error('Select an item for every Item line'); return; }
      if (l.kind === 'service' && !l.service_id) { toast.error('Select a service for every Service line'); return; }
      if (l.quantity <= 0) { toast.error('Quantity must be greater than 0'); return; }
    }
    if (totalWeight !== 100) { toast.error('Criteria weights must sum to 100%'); return; }

    setSubmitting(true);
    try {
      const { error: rfpError } = await supabase
        .from('rfps')
        .update({ title, description: description || null, deadline: deadline || null })
        .eq('id', rfpId);
      if (rfpError) throw rfpError;

      const { error: delItemsErr } = await supabase.from('rfp_items').delete().eq('rfp_id', rfpId);
      if (delItemsErr) throw delItemsErr;

      const { error: insItemsErr } = await supabase.from('rfp_items').insert(
        rfpItems.map(i => ({
          rfp_id: rfpId,
          item_id: i.kind === 'item' ? i.item_id : null,
          service_id: i.kind === 'service' ? i.service_id : null,
          quantity: i.quantity,
          specifications: i.specifications || null,
        })) as any
      );
      if (insItemsErr) throw insItemsErr;

      const { error: delCriteriaErr } = await supabase.from('rfp_criteria').delete().eq('rfp_id', rfpId);
      if (delCriteriaErr) throw delCriteriaErr;

      const { error: insCriteriaErr } = await supabase.from('rfp_criteria').insert(
        criteria.map(c => ({ rfp_id: rfpId, criterion_name: c.criterion_name, weight: c.weight, description: c.description || null }))
      );
      if (insCriteriaErr) throw insCriteriaErr;

      toast.success('RFP updated successfully');
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update RFP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit RFP</DialogTitle></DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Items / Services Required</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setRfpItems([...rfpItems, { kind: 'item', item_id: '', service_id: '', quantity: 1, specifications: '' }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Line
              </Button>
            </div>
            <div className="space-y-3">
              {rfpItems.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-md">
                  <div className="col-span-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={line.kind} onValueChange={(v: 'item' | 'service') => updateLine(idx, { kind: v, item_id: '', service_id: '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="item">Item</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">{line.kind === 'item' ? 'Item' : 'Service'}</Label>
                    {line.kind === 'item' ? (
                      <Select value={line.item_id} onValueChange={v => updateLine(idx, { item_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {items.map(i => <SelectItem key={i.id} value={i.id}>{i.code} - {i.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={line.service_id} onValueChange={v => updateLine(idx, { service_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Specifications</Label>
                    <Input value={line.specifications} onChange={e => updateLine(idx, { specifications: e.target.value })} placeholder="Specifications" />
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
                  <div className="col-span-4"><Input value={c.criterion_name} onChange={e => { const n = [...criteria]; n[idx].criterion_name = e.target.value; setCriteria(n); }} placeholder="Criterion" /></div>
                  <div className="col-span-2"><Input type="number" min={0} max={100} value={c.weight} onChange={e => { const n = [...criteria]; n[idx].weight = Number(e.target.value); setCriteria(n); }} /></div>
                  <div className="col-span-5"><Input value={c.description} onChange={e => { const n = [...criteria]; n[idx].description = e.target.value; setCriteria(n); }} placeholder="Description" /></div>
                  <div className="col-span-1">
                    {criteria.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeCriterion(idx)}>
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
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

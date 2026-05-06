import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Item { id: string; code: string; name: string; }
interface Service { id: string; code: string; name: string; }
interface ApprovedRequisition { id: string; req_number: string; department: string | null; }

interface PrefillLine {
  kind: 'item' | 'service';
  item_id: string;
  service_id: string;
  quantity: number;
  specifications: string;
}

interface RFPFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId?: string;
  organizationId?: string | null;
  prefillTitle?: string;
  prefillLines?: PrefillLine[];
  requisitionId?: string;
}

interface RFPItemLine {
  kind: 'item' | 'service';
  item_id: string;
  service_id: string;
  quantity: number;
  specifications: string;
}

interface CriterionLine {
  criterion_name: string;
  weight: number;
  description: string;
}

export function RFPFormDialog({ open, onOpenChange, onSuccess, userId, organizationId, prefillTitle, prefillLines, requisitionId }: RFPFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<ApprovedRequisition[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [rfpItems, setRfpItems] = useState<RFPItemLine[]>([{ kind: 'item', item_id: '', service_id: '', quantity: 1, specifications: '' }]);
  const [criteria, setCriteria] = useState<CriterionLine[]>([
    { criterion_name: 'Price', weight: 25, description: 'Total cost competitiveness' },
    { criterion_name: 'Experience', weight: 25, description: 'Past performance and relevant projects' },
    { criterion_name: 'Delivery Timeline', weight: 25, description: 'Proposed delivery schedule' },
    { criterion_name: 'Quality', weight: 25, description: 'Quality standards and certifications' },
  ]);
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
    if (open) {
      supabase.from('items').select('id, code, name').eq('is_active', true).order('name')
        .then(({ data }) => setItems((data || []) as Item[]));
      supabase.from('services').select('id, code, name').eq('is_active', true).order('name')
        .then(({ data }) => setServices((data || []) as Service[]));
      // Load approved requisitions (not yet fully converted) for selection
      supabase.from('requisitions')
        .select('id, req_number, department')
        .in('status', ['approved', 'partially_converted'])
        .order('created_at', { ascending: false })
        .then(({ data }) => setApprovedReqs((data || []) as ApprovedRequisition[]));
      if (prefillTitle) setTitle(prefillTitle);
      if (prefillLines && prefillLines.length > 0) setRfpItems(prefillLines);
      if (requisitionId) setSelectedReqId(requisitionId);
    }
  }, [open, prefillTitle, prefillLines, requisitionId]);

  // When user picks a requisition from the dropdown, load its lines
  const handleRequisitionSelect = async (reqId: string) => {
    setSelectedReqId(reqId);
    if (!reqId) return;
    const [{ data: req }, { data: reqLines }] = await Promise.all([
      supabase.from('requisitions').select('req_number, justification').eq('id', reqId).single(),
      supabase.from('requisition_lines')
        .select('item_id, service_id, quantity, qty_converted, specifications, items(name), services(name)')
        .eq('requisition_id', reqId)
        .order('line_number'),
    ]);
    if (req && !title) setTitle(`RFP for ${(req as any).req_number}`);
    if (req?.justification) {
      setDescription(prev => prev ? prev : `Based on Requisition ${(req as any).req_number}:\n${(req as any).justification}`);
    }
    const remaining = (reqLines || []).filter((l: any) => Number(l.quantity) - Number(l.qty_converted || 0) > 0);
    if (remaining.length === 0) {
      toast.error('This requisition has no remaining quantity to source');
      return;
    }
    setRfpItems(remaining.map((l: any) => ({
      kind: l.item_id ? 'item' : 'service',
      item_id: l.item_id || '',
      service_id: l.service_id || '',
      quantity: Number(l.quantity) - Number(l.qty_converted || 0),
      specifications: l.specifications || '',
    })));
  };

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

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
      const rfpNumber = await getNextTransactionNumber(organizationId!, 'RFP', 'RFP');

      const { data: rfp, error: rfpError } = await supabase
        .from('rfps')
        .insert({
          rfp_number: rfpNumber, title,
          description: description || null,
          payment_terms: paymentTerms || null,
          deadline: deadline || null,
          created_by: userId,
          organization_id: organizationId,
          requisition_id: selectedReqId || requisitionId || null,
        } as any)
        .select().single();
      if (rfpError) throw rfpError;

      const { error: itemsError } = await supabase.from('rfp_items').insert(
        rfpItems.map(i => ({
          rfp_id: rfp.id,
          item_id: i.kind === 'item' ? i.item_id : null,
          service_id: i.kind === 'service' ? i.service_id : null,
          quantity: i.quantity,
          specifications: i.specifications || null,
        })) as any
      );
      if (itemsError) throw itemsError;

      const { error: criteriaError } = await supabase.from('rfp_criteria').insert(
        criteria.map(c => ({ rfp_id: rfp.id, criterion_name: c.criterion_name, weight: c.weight, description: c.description || null }))
      );
      if (criteriaError) throw criteriaError;

      toast.success('RFP created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create RFP');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setPaymentTerms(''); setDeadline(''); setSelectedReqId('');
    setRfpItems([{ kind: 'item', item_id: '', service_id: '', quantity: 1, specifications: '' }]);
    setCriteria([
      { criterion_name: 'Price', weight: 25, description: 'Total cost competitiveness' },
      { criterion_name: 'Experience', weight: 25, description: 'Past performance and relevant projects' },
      { criterion_name: 'Delivery Timeline', weight: 25, description: 'Proposed delivery schedule' },
      { criterion_name: 'Quality', weight: 25, description: 'Quality standards and certifications' },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<RFPItemLine>) => {
    const n = [...rfpItems]; n[idx] = { ...n[idx], ...patch }; setRfpItems(n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create New RFP</DialogTitle></DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {!requisitionId && (
              <div className="col-span-2">
                <Label>Source Requisition *</Label>
                <Select value={selectedReqId || 'none'} onValueChange={v => handleRequisitionSelect(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select an approved requisition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None (manual entry) —</SelectItem>
                    {approvedReqs.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.req_number}{r.department ? ` · ${r.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick an approved requisition to auto-fill the lines below.
                </p>
              </div>
            )}
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office Equipment Supply" />
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
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating...' : 'Create RFP'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentTermsField } from '@/components/shared/PaymentTermsField';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { POMilestone, blankMilestone, milestoneValue, milestonesTotal } from '@/lib/po-milestones';

interface Props {
  terms: string;
  onTermsChange: (v: string) => void;
  milestones: POMilestone[];
  onMilestonesChange: (m: POMilestone[]) => void;
  poTotal: number;
}

/** True when the chosen payment terms imply a staged / partial payment plan. */
export function termsNeedMilestones(terms: string) {
  const t = (terms || '').toLowerCase();
  return t.includes('partial') || t.includes('milestone') || t.includes('advance') || t.includes('%');
}

export function PaymentScheduleEditor({ terms, onTermsChange, milestones, onMilestonesChange, poTotal }: Props) {
  const update = (idx: number, patch: Partial<POMilestone>) => {
    const next = [...milestones];
    next[idx] = { ...next[idx], ...patch };
    onMilestonesChange(next);
  };

  const setCount = (n: number) => {
    const next = [...milestones];
    while (next.length < n) next.push(blankMilestone());
    onMilestonesChange(next.slice(0, n));
  };

  const scheduled = milestonesTotal(milestones, poTotal);
  const diff = Math.round((poTotal - scheduled) * 100) / 100;
  const suggested = termsNeedMilestones(terms);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <PaymentTermsField value={terms} onChange={onTermsChange} multiline />

      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <Label>Number of Milestone Payments</Label>
          <Input
            type="number"
            min={0}
            max={20}
            className="w-32"
            value={milestones.length}
            onChange={e => setCount(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
          />
          {suggested && milestones.length === 0 && (
            <p className="text-xs text-destructive">
              These terms suggest staged payments — add at least one milestone.
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onMilestonesChange([...milestones, blankMilestone()])}>
          <Plus className="h-4 w-4 mr-1" /> Add Milestone
        </Button>
      </div>

      {milestones.length > 0 && (
        <div className="space-y-2">
          {milestones.map((m, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6 space-y-1">
                <Label className="text-xs">Milestone {idx + 1} description</Label>
                <Input
                  value={m.description}
                  placeholder="e.g. Advance on signing"
                  onChange={e => update(idx, { description: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Basis</Label>
                <Select value={m.basis} onValueChange={(v: any) => update(idx, { basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="value">Fixed value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">{m.basis === 'percentage' ? 'Percent' : 'Amount'}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={m.basis === 'percentage' ? m.percentage : m.amount}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    update(idx, m.basis === 'percentage' ? { percentage: val } : { amount: val });
                  }}
                />
              </div>
              <div className="col-span-1 text-right text-sm font-medium pb-2">
                {formatCurrency(milestoneValue(m, poTotal))}
              </div>
              <div className="col-span-1 pb-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => onMilestonesChange(milestones.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 pt-2 text-sm">
            <span className="text-muted-foreground">Scheduled: <strong className="text-foreground">{formatCurrency(scheduled)}</strong> of {formatCurrency(poTotal)}</span>
            {Math.abs(diff) < 0.01 ? (
              <Badge variant="secondary">Fully scheduled</Badge>
            ) : (
              <Badge variant="destructive">{diff > 0 ? `${formatCurrency(diff)} unscheduled` : `${formatCurrency(Math.abs(diff))} over PO total`}</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

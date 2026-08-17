import { supabase } from '@/integrations/supabase/client';

export interface POMilestone {
  id?: string;
  description: string;
  basis: 'percentage' | 'value';
  percentage: number;
  amount: number;
  due_date: string | null;
}

export function blankMilestone(): POMilestone {
  return { description: '', basis: 'percentage', percentage: 0, amount: 0, due_date: null };
}

/** Resolve the money value of a milestone against the PO total. */
export function milestoneValue(m: POMilestone, poTotal: number): number {
  if (m.basis === 'percentage') return Math.round(((poTotal * (m.percentage || 0)) / 100) * 100) / 100;
  return m.amount || 0;
}

export function milestonesTotal(list: POMilestone[], poTotal: number): number {
  return list.reduce((s, m) => s + milestoneValue(m, poTotal), 0);
}

/** Replace the milestone schedule stored for a PO. */
export async function savePOMilestones(
  poId: string,
  organizationId: string,
  milestones: POMilestone[],
  poTotal: number,
) {
  await (supabase.from('po_payment_milestones' as any) as any).delete().eq('po_id', poId);
  const rows = milestones
    .filter(m => (m.description || '').trim() || milestoneValue(m, poTotal) > 0)
    .map((m, idx) => ({
      po_id: poId,
      organization_id: organizationId,
      milestone_no: idx + 1,
      description: m.description || `Milestone ${idx + 1}`,
      basis: m.basis,
      percentage: m.basis === 'percentage' ? m.percentage || 0 : 0,
      amount: milestoneValue(m, poTotal),
      due_date: m.due_date || null,
    }));
  if (!rows.length) return;
  const { error } = await (supabase.from('po_payment_milestones' as any) as any).insert(rows);
  if (error) throw error;
}

export async function fetchPOMilestones(poId: string) {
  const { data } = await (supabase.from('po_payment_milestones' as any) as any)
    .select('*')
    .eq('po_id', poId)
    .order('milestone_no');
  return (data || []) as any[];
}

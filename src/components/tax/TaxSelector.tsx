import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/currency';

export interface TaxGroupOption {
  id: string;
  name: string;
  is_default: boolean;
  total_rate_pct: number;
}

interface Props {
  subtotal: number;
  /** Selected tax group id, or '' / 'none' for no tax */
  value: string;
  onChange: (groupId: string, totalRatePct: number, taxAmount: number) => void;
  label?: string;
  autoSelectDefault?: boolean;
  className?: string;
}

/**
 * VAT/Tax selector that reads tax_groups + tax_rates from configuration
 * and computes tax = subtotal * (sum of active rate_pct in the group) / 100.
 * Used by AR / AP invoice forms so every posting recognises the configured VAT %.
 */
export function TaxSelector({ subtotal, value, onChange, label = 'VAT / Tax', autoSelectDefault = true, className }: Props) {
  const { data: groups = [] } = useQuery({
    queryKey: ['tax-groups-with-rates'],
    queryFn: async () => {
      const [g, r] = await Promise.all([
        supabase.from('tax_groups').select('id, name, is_default, is_active').eq('is_active', true).order('name'),
        supabase.from('tax_rates').select('id, tax_group_id, rate_pct, is_active').eq('is_active', true),
      ]);
      const rates = r.data || [];
      return (g.data || []).map((grp: any) => ({
        id: grp.id,
        name: grp.name,
        is_default: !!grp.is_default,
        total_rate_pct: rates
          .filter((rt: any) => rt.tax_group_id === grp.id)
          .reduce((s: number, rt: any) => s + Number(rt.rate_pct || 0), 0),
      })) as TaxGroupOption[];
    },
  });

  const selected = useMemo(() => groups.find(g => g.id === value), [groups, value]);
  const ratePct = selected?.total_rate_pct || 0;
  const taxAmount = +(subtotal * ratePct / 100).toFixed(2);

  // Push recalculated amount whenever subtotal changes for the selected group
  useEffect(() => {
    if (selected) onChange(selected.id, ratePct, taxAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, selected?.id, ratePct]);

  // Auto-select default group on first load
  useEffect(() => {
    if (!autoSelectDefault) return;
    if (value && value !== 'none') return;
    const def = groups.find(g => g.is_default);
    if (def) onChange(def.id, def.total_rate_pct, +(subtotal * def.total_rate_pct / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select
        value={value || 'none'}
        onValueChange={(v) => {
          if (v === 'none') { onChange('', 0, 0); return; }
          const g = groups.find(x => x.id === v);
          if (!g) return;
          onChange(g.id, g.total_rate_pct, +(subtotal * g.total_rate_pct / 100).toFixed(2));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="No tax" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No tax (0%)</SelectItem>
          {groups.map(g => (
            <SelectItem key={g.id} value={g.id}>
              {g.name} — {g.total_rate_pct}%{g.is_default ? ' (default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">
        {ratePct > 0
          ? `${ratePct}% of ${formatCurrency(subtotal)} = ${formatCurrency(taxAmount)}`
          : 'No VAT applied'}
      </p>
    </div>
  );
}

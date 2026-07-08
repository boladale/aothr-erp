import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo } from 'react';

export const PAYMENT_TERMS_PRESETS = [
  'Net 30',
  'Net 60',
  'Net 90',
  '100% Advance Payment',
  '50% Advance, 50% on Delivery',
  '100% on Delivery',
  'Cash on Delivery',
  'Partial Payment (Milestone-based)',
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}

/**
 * Reusable Payment Terms input with preset options + "Other/Custom" free-text fallback
 * so users can either pick a standard term or type in negotiated terms manually.
 */
export function PaymentTermsField({
  value,
  onChange,
  label = 'Payment Terms',
  placeholder = 'e.g. Net 30 days after delivery',
  className,
  multiline = false,
}: Props) {
  const selected = useMemo(() => {
    if (!value) return '';
    return PAYMENT_TERMS_PRESETS.includes(value) ? value : '__other__';
  }, [value]);

  const isOther = selected === '__other__';

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select
        value={selected || undefined}
        onValueChange={(v) => {
          if (v === '__other__') {
            // switch to custom without wiping any typed value
            if (PAYMENT_TERMS_PRESETS.includes(value)) onChange('');
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select payment terms" />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_TERMS_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
          <SelectItem value="__other__">Other / Custom…</SelectItem>
        </SelectContent>
      </Select>
      {isOther && (
        <div className="mt-2">
          {multiline ? (
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={2}
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
            />
          )}
        </div>
      )}
    </div>
  );
}

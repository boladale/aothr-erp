import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


import { useState, useEffect } from 'react';

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
  placeholder = 'Type the negotiated payment terms…',
  className,
  multiline = false,
}: Props) {
  // Track whether user explicitly picked "Other/Custom" so the input shows
  // even when the value is still empty.
  const [otherMode, setOtherMode] = useState<boolean>(
    !!value && !PAYMENT_TERMS_PRESETS.includes(value)
  );

  // Keep otherMode in sync if parent switches the value to a preset externally.
  useEffect(() => {
    if (value && PAYMENT_TERMS_PRESETS.includes(value)) {
      setOtherMode(false);
    } else if (value && !PAYMENT_TERMS_PRESETS.includes(value)) {
      setOtherMode(true);
    }
  }, [value]);

  const selectValue = otherMode
    ? '__other__'
    : (PAYMENT_TERMS_PRESETS.includes(value) ? value : undefined);

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === '__other__') {
            setOtherMode(true);
            if (PAYMENT_TERMS_PRESETS.includes(value)) onChange('');
          } else {
            setOtherMode(false);
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
      {otherMode && (
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">Enter custom payment terms</Label>
          {multiline ? (
            <Textarea
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={2}
            />
          ) : (
            <Input
              autoFocus
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

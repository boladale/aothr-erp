import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CurrencySelectorProps {
  currency: string;
  exchangeRate: number;
  onCurrencyChange: (currency: string) => void;
  onExchangeRateChange: (rate: number) => void;
  className?: string;
}

export function CurrencySelector({ currency, exchangeRate, onCurrencyChange, onExchangeRateChange, className }: CurrencySelectorProps) {
  const { isMulticurrency, baseCurrency, currencies, getCurrencySymbol } = useOrgCurrency();
  const { organizationId } = useAuth();

  // Auto-fetch exchange rate when currency changes
  useEffect(() => {
    if (!isMulticurrency || currency === baseCurrency) {
      onExchangeRateChange(1.0);
      return;
    }
    const fetchRate = async () => {
      if (!organizationId) return;
      const { data } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('organization_id', organizationId)
        .eq('from_currency', currency)
        .eq('to_currency', baseCurrency)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) onExchangeRateChange(Number(data.rate));
    };
    fetchRate();
  }, [currency, baseCurrency, organizationId]);

  if (!isMulticurrency) return null;

  return (
    <div className={`grid grid-cols-2 gap-4 ${className || ''}`}>
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map(c => (
              <SelectItem key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Exchange Rate (to {baseCurrency})</Label>
        <Input
          type="number"
          step="0.000001"
          value={exchangeRate}
          onChange={e => onExchangeRateChange(parseFloat(e.target.value) || 1)}
          disabled={currency === baseCurrency}
        />
      </div>
    </div>
  );
}

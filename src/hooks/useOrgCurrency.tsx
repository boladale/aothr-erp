import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

interface OrgCurrencyContext {
  isMulticurrency: boolean;
  baseCurrency: string;
  baseCurrencySymbol: string;
  currencies: Currency[];
  loading: boolean;
  getCurrencySymbol: (code: string) => string;
  refreshSettings: () => Promise<void>;
}

const OrgCurrencyCtx = createContext<OrgCurrencyContext>({
  isMulticurrency: false,
  baseCurrency: 'NGN',
  baseCurrencySymbol: '₦',
  currencies: [],
  loading: true,
  getCurrencySymbol: () => '₦',
  refreshSettings: async () => {},
});

export function OrgCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { organizationId } = useAuth();
  const [isMulticurrency, setIsMulticurrency] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('NGN');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const [orgRes, currRes] = await Promise.all([
      organizationId
        ? supabase.from('organizations').select('is_multicurrency, base_currency').eq('id', organizationId).single()
        : Promise.resolve({ data: null }),
      supabase.from('currencies').select('code, name, symbol').eq('is_active', true).order('code'),
    ]);

    if (orgRes.data) {
      const d = orgRes.data as any;
      setIsMulticurrency(d.is_multicurrency ?? false);
      setBaseCurrency(d.base_currency ?? 'NGN');
    }
    setCurrencies((currRes.data as Currency[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, [organizationId]);

  const getCurrencySymbol = (code: string) => {
    const c = currencies.find(c => c.code === code);
    return c?.symbol || code;
  };

  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);

  return (
    <OrgCurrencyCtx.Provider value={{ isMulticurrency, baseCurrency, baseCurrencySymbol, currencies, loading, getCurrencySymbol, refreshSettings: fetchSettings }}>
      {children}
    </OrgCurrencyCtx.Provider>
  );
}

export function useOrgCurrency() {
  return useContext(OrgCurrencyCtx);
}

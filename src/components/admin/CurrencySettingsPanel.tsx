import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Coins, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

export function CurrencySettingsPanel() {
  const { organizationId } = useAuth();
  const { isMulticurrency, baseCurrency, currencies, refreshSettings } = useOrgCurrency();
  const [multiToggle, setMultiToggle] = useState(isMulticurrency);
  const [selectedBase, setSelectedBase] = useState(baseCurrency);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [addRateOpen, setAddRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ from_currency: '', to_currency: '', rate: '', effective_date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    setMultiToggle(isMulticurrency);
    setSelectedBase(baseCurrency);
  }, [isMulticurrency, baseCurrency]);

  useEffect(() => {
    if (multiToggle && organizationId) fetchRates();
  }, [multiToggle, organizationId]);

  const fetchRates = async () => {
    if (!organizationId) return;
    setRatesLoading(true);
    const { data } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('effective_date', { ascending: false })
      .limit(100);
    setRates((data as ExchangeRate[]) || []);
    setRatesLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!organizationId) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ is_multicurrency: multiToggle, base_currency: selectedBase })
      .eq('id', organizationId);

    if (error) {
      toast.error('Failed to save currency settings');
    } else {
      toast.success('Currency settings saved');
      await refreshSettings();
    }
    setSaving(false);
  };

  const handleAddRate = async () => {
    if (!organizationId || !rateForm.from_currency || !rateForm.to_currency || !rateForm.rate) {
      toast.error('Fill all fields');
      return;
    }
    const { error } = await supabase.from('exchange_rates').insert({
      organization_id: organizationId,
      from_currency: rateForm.from_currency,
      to_currency: rateForm.to_currency,
      rate: parseFloat(rateForm.rate),
      effective_date: rateForm.effective_date,
    });
    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('Rate for this currency pair and date already exists');
      } else {
        toast.error('Failed to add rate');
      }
      return;
    }
    toast.success('Exchange rate added');
    setAddRateOpen(false);
    setRateForm({ from_currency: '', to_currency: '', rate: '', effective_date: new Date().toISOString().split('T')[0] });
    fetchRates();
  };

  const handleDeleteRate = async (id: string) => {
    const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Rate deleted');
    fetchRates();
  };

  const rateColumns = [
    { key: 'from_currency', header: 'From', render: (r: ExchangeRate) => <Badge variant="outline">{r.from_currency}</Badge> },
    { key: 'to_currency', header: 'To', render: (r: ExchangeRate) => <Badge variant="outline">{r.to_currency}</Badge> },
    { key: 'rate', header: 'Rate', render: (r: ExchangeRate) => <span className="font-mono">{r.rate}</span> },
    { key: 'effective_date', header: 'Effective Date', render: (r: ExchangeRate) => r.effective_date },
    {
      key: 'actions', header: '',
      render: (r: ExchangeRate) => (
        <Button size="sm" variant="ghost" onClick={() => handleDeleteRate(r.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" /> Currency Settings</CardTitle>
          <CardDescription>Configure single or multicurrency mode for your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base font-medium">Multicurrency Mode</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enable to allow transactions in multiple currencies with exchange rate tracking
              </p>
            </div>
            <Switch checked={multiToggle} onCheckedChange={setMultiToggle} />
          </div>

          <div className="space-y-2">
            <Label>Base Currency</Label>
            <Select value={selectedBase} onValueChange={setSelectedBase}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {multiToggle && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Exchange Rates</CardTitle>
              <CardDescription>Manage currency exchange rates. The latest rate for each pair is used automatically.</CardDescription>
            </div>
            <Button onClick={() => setAddRateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Rate
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable columns={rateColumns} data={rates} loading={ratesLoading} emptyMessage="No exchange rates configured" />
          </CardContent>
        </Card>
      )}

      <Dialog open={addRateOpen} onOpenChange={setAddRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exchange Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Currency</Label>
                <Select value={rateForm.from_currency} onValueChange={v => setRateForm(f => ({ ...f, from_currency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Currency</Label>
                <Select value={rateForm.to_currency} onValueChange={v => setRateForm(f => ({ ...f, to_currency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate</Label>
                <Input type="number" step="0.000001" placeholder="1.000000" value={rateForm.rate} onChange={e => setRateForm(f => ({ ...f, rate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={rateForm.effective_date} onChange={e => setRateForm(f => ({ ...f, effective_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRateOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRate}>Add Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

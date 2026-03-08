import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TaxGroup {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  rates?: TaxRate[];
}

interface TaxRate {
  id: string;
  tax_group_id: string;
  name: string;
  rate_pct: number;
  gl_account_id: string | null;
  is_active: boolean;
}

export default function TaxConfiguration() {
  const [groups, setGroups] = useState<TaxGroup[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TaxGroup | null>(null);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_default: false });
  const [rateForm, setRateForm] = useState({ name: '', rate_pct: '', gl_account_id: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [groupsRes, ratesRes, accountsRes] = await Promise.all([
      supabase.from('tax_groups').select('*').order('name'),
      supabase.from('tax_rates').select('*').order('name'),
      supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_header', false).eq('is_active', true).order('account_code'),
    ]);

    const groupsWithRates = (groupsRes.data || []).map((g: any) => ({
      ...g,
      rates: (ratesRes.data || []).filter((r: any) => r.tax_group_id === g.id),
    }));
    setGroups(groupsWithRates);
    setGlAccounts(accountsRes.data || []);
    setLoading(false);
  };

  const handleSaveGroup = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (editingGroup) {
      const { error } = await supabase.from('tax_groups').update({ name: form.name, description: form.description || null, is_default: form.is_default }).eq('id', editingGroup.id);
      if (error) return toast.error(error.message);
      toast.success('Tax group updated');
    } else {
      const { error } = await supabase.from('tax_groups').insert({ name: form.name, description: form.description || null, is_default: form.is_default });
      if (error) return toast.error(error.message);
      toast.success('Tax group created');
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleToggleGroup = async (id: string, is_active: boolean) => {
    await supabase.from('tax_groups').update({ is_active }).eq('id', id);
    fetchData();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this tax group and all its rates?')) return;
    const { error } = await supabase.from('tax_groups').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Tax group deleted');
    fetchData();
  };

  const handleSaveRate = async () => {
    if (!rateForm.name.trim() || !selectedGroupId) return toast.error('Name is required');
    const data = {
      name: rateForm.name,
      rate_pct: parseFloat(rateForm.rate_pct) || 0,
      gl_account_id: rateForm.gl_account_id || null,
      tax_group_id: selectedGroupId,
    };
    if (editingRate) {
      const { error } = await supabase.from('tax_rates').update(data).eq('id', editingRate.id);
      if (error) return toast.error(error.message);
      toast.success('Tax rate updated');
    } else {
      const { error } = await supabase.from('tax_rates').insert(data);
      if (error) return toast.error(error.message);
      toast.success('Tax rate added');
    }
    setRateDialogOpen(false);
    fetchData();
  };

  const handleDeleteRate = async (id: string) => {
    await supabase.from('tax_rates').delete().eq('id', id);
    toast.success('Tax rate deleted');
    fetchData();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Tax Configuration" description="Manage tax groups and rates for transactions" actions={
          <Button onClick={() => { setEditingGroup(null); setForm({ name: '', description: '', is_default: false }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Tax Group
          </Button>
        } />

        {loading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.is_default && <StatusBadge status="default" />}
                      <StatusBadge status={group.is_active ? 'active' : 'inactive'} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={group.is_active} onCheckedChange={(v) => handleToggleGroup(group.id, v)} />
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditingGroup(group); setForm({ name: group.name, description: group.description || '', is_default: group.is_default }); setDialogOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(group.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.rates?.map(rate => (
                      <div key={rate.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-3">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{rate.name}</span>
                          <span className="text-sm text-primary font-semibold">{rate.rate_pct}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingRate(rate); setSelectedGroupId(group.id);
                            setRateForm({ name: rate.name, rate_pct: rate.rate_pct.toString(), gl_account_id: rate.gl_account_id || '' });
                            setRateDialogOpen(true);
                          }}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRate(rate.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                      setEditingRate(null); setSelectedGroupId(group.id);
                      setRateForm({ name: '', rate_pct: '', gl_account_id: '' });
                      setRateDialogOpen(true);
                    }}>
                      <Plus className="h-3 w-3 mr-1" /> Add Rate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tax Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroup ? 'Edit' : 'New'} Tax Group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_default} onCheckedChange={v => setForm({ ...form, is_default: v })} /><Label>Default group</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRate ? 'Edit' : 'New'} Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={rateForm.name} onChange={e => setRateForm({ ...rateForm, name: e.target.value })} placeholder="e.g. VAT 7.5%" /></div>
            <div><Label>Rate (%)</Label><Input type="number" step="0.01" value={rateForm.rate_pct} onChange={e => setRateForm({ ...rateForm, rate_pct: e.target.value })} /></div>
            <div>
              <Label>GL Account (Tax Liability)</Label>
              <Select value={rateForm.gl_account_id} onValueChange={v => setRateForm({ ...rateForm, gl_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select GL account" /></SelectTrigger>
                <SelectContent>
                  {glAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

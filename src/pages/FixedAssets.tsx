import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Edit, Calculator, PackageX } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function FixedAssets() {
  const { organizationId } = useAuth();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['fa-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_asset_categories' as any).select('*').order('name');
      if (error) throw error; return data as any[];
    },
  });
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_assets' as any)
        .select('*, category:fixed_asset_categories(name), location:locations(name)')
        .order('acquisition_date', { ascending: false });
      if (error) throw error; return data as any[];
    },
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['fa-locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('*').eq('is_active', true).order('name');
      if (error) throw error; return data;
    },
  });
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['fa-gl-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name, account_type').order('account_code');
      if (error) throw error; return data;
    },
  });
  const { data: depreciationHistory = [] } = useQuery({
    queryKey: ['fa-depreciation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_asset_depreciation' as any)
        .select('*, asset:fixed_assets(asset_code, name)')
        .order('period_date', { ascending: false }).limit(200);
      if (error) throw error; return data as any[];
    },
  });

  // ---- Category dialog ----
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const emptyCat = {
    code: '', name: '', useful_life_years: 5, depreciation_method: 'straight_line', depreciation_rate: 0,
    asset_gl_account_id: '', accum_depr_gl_account_id: '', depr_expense_gl_account_id: '',
    disposal_gain_gl_account_id: '', disposal_loss_gl_account_id: '',
  };
  const [catForm, setCatForm] = useState<any>(emptyCat);

  const saveCat = useMutation({
    mutationFn: async () => {
      const payload: any = { ...catForm, organization_id: organizationId };
      ['asset_gl_account_id','accum_depr_gl_account_id','depr_expense_gl_account_id','disposal_gain_gl_account_id','disposal_loss_gl_account_id']
        .forEach(k => { if (!payload[k]) payload[k] = null; });
      if (editingCat) {
        const { error } = await supabase.from('fixed_asset_categories' as any).update(payload).eq('id', editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixed_asset_categories' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fa-categories'] }); setCatOpen(false); setEditingCat(null); setCatForm(emptyCat); toast.success('Category saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Asset dialog ----
  const [assetOpen, setAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const emptyAsset = {
    asset_code: '', name: '', description: '', category_id: '', location_id: '', custodian: '', serial_number: '',
    acquisition_date: new Date().toISOString().slice(0, 10), acquisition_cost: 0, salvage_value: 0,
    useful_life_years: 5, depreciation_method: 'straight_line', depreciation_rate: 0,
  };
  const [assetForm, setAssetForm] = useState<any>(emptyAsset);

  const saveAsset = useMutation({
    mutationFn: async () => {
      const payload: any = { ...assetForm, organization_id: organizationId };
      ['category_id','location_id'].forEach(k => { if (!payload[k]) payload[k] = null; });
      if (editingAsset) {
        const { error } = await supabase.from('fixed_assets' as any).update(payload).eq('id', editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fixed_assets' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); setAssetOpen(false); setEditingAsset(null); setAssetForm(emptyAsset); toast.success('Asset saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openAssetEdit = (a: any) => {
    setEditingAsset(a);
    setAssetForm({
      asset_code: a.asset_code, name: a.name, description: a.description || '',
      category_id: a.category_id || '', location_id: a.location_id || '',
      custodian: a.custodian || '', serial_number: a.serial_number || '',
      acquisition_date: a.acquisition_date, acquisition_cost: a.acquisition_cost,
      salvage_value: a.salvage_value, useful_life_years: a.useful_life_years,
      depreciation_method: a.depreciation_method, depreciation_rate: a.depreciation_rate || 0,
    });
    setAssetOpen(true);
  };

  // ---- Post depreciation ----
  const [depOpen, setDepOpen] = useState(false);
  const [depDate, setDepDate] = useState(new Date().toISOString().slice(0, 10));
  const postDep = useMutation({
    mutationFn: async () => {
      const active = assets.filter((a: any) => a.status === 'active');
      let ok = 0, fail = 0; const errs: string[] = [];
      for (const a of active) {
        const { error } = await supabase.rpc('post_asset_depreciation' as any, { p_asset_id: a.id, p_period_date: depDate });
        if (error) { fail++; errs.push(`${a.asset_code}: ${error.message}`); } else ok++;
      }
      return { ok, fail, errs };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['fa-depreciation'] });
      if (r.fail === 0) toast.success(`Depreciation posted for ${r.ok} assets`);
      else toast.warning(`Posted: ${r.ok} | Skipped: ${r.fail}`, { description: r.errs.slice(0, 3).join(' | ') });
      setDepOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Dispose asset ----
  const [dispOpen, setDispOpen] = useState(false);
  const [dispAsset, setDispAsset] = useState<any>(null);
  const [dispForm, setDispForm] = useState<any>({ disposal_date: new Date().toISOString().slice(0, 10), proceeds: 0, cash_account_id: '', notes: '' });
  const disposeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('dispose_fixed_asset' as any, {
        p_asset_id: dispAsset.id, p_disposal_date: dispForm.disposal_date,
        p_proceeds: Number(dispForm.proceeds) || 0,
        p_cash_account_id: dispForm.cash_account_id || null, p_notes: dispForm.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); setDispOpen(false); toast.success('Asset disposed'); },
    onError: (e: any) => toast.error(e.message),
  });

  // Totals
  const totalCost = assets.filter((a: any) => a.status === 'active').reduce((s: number, a: any) => s + Number(a.acquisition_cost), 0);
  const totalAccum = assets.filter((a: any) => a.status === 'active').reduce((s: number, a: any) => s + Number(a.accumulated_depreciation), 0);
  const totalNbv = totalCost - totalAccum;

  const cashAccounts = glAccounts.filter((g: any) => g.account_type === 'asset');

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader title="Fixed Assets" description="Asset register, depreciation, and disposal" />

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Cost</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{formatCurrency(totalCost)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Accumulated Depreciation</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{formatCurrency(totalAccum)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Book Value</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold text-primary">{formatCurrency(totalNbv)}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="register">
          <TabsList>
            <TabsTrigger value="register">Asset Register</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="depreciation">Depreciation History</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDepOpen(true)}><Calculator className="h-4 w-4 mr-2" />Post Monthly Depreciation</Button>
              <Button onClick={() => { setEditingAsset(null); setAssetForm(emptyAsset); setAssetOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add Asset
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                  <TableHead>Location</TableHead><TableHead>Acq Date</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Accum. Depr</TableHead>
                  <TableHead className="text-right">NBV</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right w-[140px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : assets.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No assets registered</TableCell></TableRow>
                  ) : assets.map((a: any) => {
                    const nbv = Number(a.acquisition_cost) - Number(a.accumulated_depreciation);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.asset_code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.category?.name || '-'}</TableCell>
                        <TableCell>{a.location?.name || '-'}</TableCell>
                        <TableCell>{a.acquisition_date}</TableCell>
                        <TableCell className="text-right">{formatCurrency(a.acquisition_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(a.accumulated_depreciation)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(nbv)}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="text-right">
                          {a.status === 'active' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openAssetEdit(a)} title="Edit"><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => { setDispAsset(a); setDispForm({ disposal_date: new Date().toISOString().slice(0,10), proceeds: 0, cash_account_id: '', notes: '' }); setDispOpen(true); }} title="Dispose"><PackageX className="h-4 w-4" /></Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingCat(null); setCatForm(emptyCat); setCatOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add Category
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Method</TableHead>
                  <TableHead className="text-right">Useful Life</TableHead>
                  <TableHead>Asset A/C</TableHead><TableHead>Accum. Depr A/C</TableHead><TableHead>Depr Expense A/C</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No categories yet. Add one to start registering assets.</TableCell></TableRow>
                  ) : categories.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.code}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.depreciation_method === 'reducing_balance' ? `Reducing ${c.depreciation_rate}%` : 'Straight-line'}</TableCell>
                      <TableCell className="text-right">{c.useful_life_years} yrs</TableCell>
                      <TableCell className="text-xs">{glAccounts.find((g: any) => g.id === c.asset_gl_account_id)?.account_code || '-'}</TableCell>
                      <TableCell className="text-xs">{glAccounts.find((g: any) => g.id === c.accum_depr_gl_account_id)?.account_code || '-'}</TableCell>
                      <TableCell className="text-xs">{glAccounts.find((g: any) => g.id === c.depr_expense_gl_account_id)?.account_code || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCat(c); setCatForm({
                          code: c.code, name: c.name, useful_life_years: c.useful_life_years,
                          depreciation_method: c.depreciation_method, depreciation_rate: c.depreciation_rate || 0,
                          asset_gl_account_id: c.asset_gl_account_id || '', accum_depr_gl_account_id: c.accum_depr_gl_account_id || '',
                          depr_expense_gl_account_id: c.depr_expense_gl_account_id || '',
                          disposal_gain_gl_account_id: c.disposal_gain_gl_account_id || '',
                          disposal_loss_gl_account_id: c.disposal_loss_gl_account_id || '',
                        }); setCatOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="depreciation" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Period</TableHead><TableHead>Asset</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead className="text-right">NBV After</TableHead>
                  <TableHead>Journal</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {depreciationHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No depreciation posted yet</TableCell></TableRow>
                  ) : depreciationHistory.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.period_date}</TableCell>
                      <TableCell>{d.asset?.asset_code} — {d.asset?.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.depreciation_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.nbv_after)}</TableCell>
                      <TableCell><StatusBadge status={d.posted ? 'posted' : 'draft'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Category dialog */}
        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingCat ? 'Edit' : 'New'} Asset Category</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code</Label><Input value={catForm.code} onChange={e => setCatForm({ ...catForm, code: e.target.value })} placeholder="e.g. VEH" /></div>
              <div><Label>Name</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Vehicles" /></div>
              <div>
                <Label>Depreciation Method</Label>
                <Select value={catForm.depreciation_method} onValueChange={v => setCatForm({ ...catForm, depreciation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">Straight-line</SelectItem>
                    <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Useful Life (years)</Label><Input type="number" value={catForm.useful_life_years} onChange={e => setCatForm({ ...catForm, useful_life_years: Number(e.target.value) })} /></div>
              {catForm.depreciation_method === 'reducing_balance' && (
                <div className="col-span-2"><Label>Annual Depr Rate (%)</Label><Input type="number" step="0.01" value={catForm.depreciation_rate} onChange={e => setCatForm({ ...catForm, depreciation_rate: Number(e.target.value) })} /></div>
              )}
              
              {[
                ['asset_gl_account_id','Asset GL Account (Fixed Asset)'],
                ['accum_depr_gl_account_id','Accumulated Depreciation GL (Contra-asset)'],
                ['depr_expense_gl_account_id','Depreciation Expense GL'],
                ['disposal_gain_gl_account_id','Gain on Disposal GL (Revenue)'],
                ['disposal_loss_gl_account_id','Loss on Disposal GL (Expense)'],
              ].map(([k, label]) => (
                <div key={k} className="col-span-2">
                  <Label>{label}</Label>
                  <Select value={catForm[k] || 'none'} onValueChange={v => setCatForm({ ...catForm, [k]: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {glAccounts.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>{g.account_code} - {g.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
              <Button onClick={() => saveCat.mutate()} disabled={!catForm.code || !catForm.name || saveCat.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Asset dialog */}
        <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingAsset ? 'Edit' : 'New'} Fixed Asset</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Asset Code</Label><Input value={assetForm.asset_code} onChange={e => setAssetForm({ ...assetForm, asset_code: e.target.value })} placeholder="e.g. FA-0001" /></div>
              <div><Label>Name</Label><Input value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={assetForm.category_id || 'none'} onValueChange={v => {
                  const cat = categories.find((c: any) => c.id === v);
                  setAssetForm({
                    ...assetForm, category_id: v === 'none' ? '' : v,
                    useful_life_years: cat?.useful_life_years ?? assetForm.useful_life_years,
                    depreciation_method: cat?.depreciation_method ?? assetForm.depreciation_method,
                    depreciation_rate: cat?.depreciation_rate ?? assetForm.depreciation_rate,
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Select value={assetForm.location_id || 'none'} onValueChange={v => setAssetForm({ ...assetForm, location_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Custodian</Label><Input value={assetForm.custodian} onChange={e => setAssetForm({ ...assetForm, custodian: e.target.value })} placeholder="Person responsible" /></div>
              <div><Label>Serial Number</Label><Input value={assetForm.serial_number} onChange={e => setAssetForm({ ...assetForm, serial_number: e.target.value })} /></div>
              <div><Label>Acquisition Date</Label><Input type="date" value={assetForm.acquisition_date} onChange={e => setAssetForm({ ...assetForm, acquisition_date: e.target.value })} /></div>
              <div><Label>Acquisition Cost</Label><Input type="number" step="0.01" value={assetForm.acquisition_cost} onChange={e => setAssetForm({ ...assetForm, acquisition_cost: Number(e.target.value) })} /></div>
              <div><Label>Salvage Value</Label><Input type="number" step="0.01" value={assetForm.salvage_value} onChange={e => setAssetForm({ ...assetForm, salvage_value: Number(e.target.value) })} /></div>
              <div><Label>Useful Life (yrs)</Label><Input type="number" value={assetForm.useful_life_years} onChange={e => setAssetForm({ ...assetForm, useful_life_years: Number(e.target.value) })} /></div>
              <div>
                <Label>Depreciation Method</Label>
                <Select value={assetForm.depreciation_method} onValueChange={v => setAssetForm({ ...assetForm, depreciation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">Straight-line</SelectItem>
                    <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assetForm.depreciation_method === 'reducing_balance' && (
                <div><Label>Annual Rate (%)</Label><Input type="number" step="0.01" value={assetForm.depreciation_rate} onChange={e => setAssetForm({ ...assetForm, depreciation_rate: Number(e.target.value) })} /></div>
              )}
              <div className="col-span-2"><Label>Description</Label><Textarea value={assetForm.description} onChange={e => setAssetForm({ ...assetForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssetOpen(false)}>Cancel</Button>
              <Button onClick={() => saveAsset.mutate()} disabled={!assetForm.asset_code || !assetForm.name || !assetForm.category_id || saveAsset.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Post depreciation dialog */}
        <Dialog open={depOpen} onOpenChange={setDepOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Post Monthly Depreciation</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Posts depreciation for all active assets on the selected period-end date. Each asset generates a balanced journal entry (DR Depreciation Expense / CR Accumulated Depreciation).</p>
              <div><Label>Period End Date</Label><Input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Active assets: {assets.filter((a: any) => a.status === 'active').length}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepOpen(false)}>Cancel</Button>
              <Button onClick={() => postDep.mutate()} disabled={postDep.isPending}>{postDep.isPending ? 'Posting...' : 'Post Depreciation'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispose dialog */}
        <Dialog open={dispOpen} onOpenChange={setDispOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispose Asset: {dispAsset?.asset_code}</DialogTitle></DialogHeader>
            {dispAsset && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <div>Cost: {formatCurrency(dispAsset.acquisition_cost)}</div>
                  <div>Accumulated Depr: {formatCurrency(dispAsset.accumulated_depreciation)}</div>
                  <div className="font-medium">NBV: {formatCurrency(Number(dispAsset.acquisition_cost) - Number(dispAsset.accumulated_depreciation))}</div>
                </div>
                <div><Label>Disposal Date</Label><Input type="date" value={dispForm.disposal_date} onChange={e => setDispForm({ ...dispForm, disposal_date: e.target.value })} /></div>
                <div><Label>Sale Proceeds</Label><Input type="number" step="0.01" value={dispForm.proceeds} onChange={e => setDispForm({ ...dispForm, proceeds: e.target.value })} /></div>
                <div>
                  <Label>Cash / Receivable Account (for proceeds)</Label>
                  <Select value={dispForm.cash_account_id || 'none'} onValueChange={v => setDispForm({ ...dispForm, cash_account_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None (write-off) --</SelectItem>
                      {cashAccounts.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.account_code} - {g.account_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea value={dispForm.notes} onChange={e => setDispForm({ ...dispForm, notes: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDispOpen(false)}>Cancel</Button>
              <Button onClick={() => disposeMut.mutate()} disabled={disposeMut.isPending}>{disposeMut.isPending ? 'Processing...' : 'Dispose Asset'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

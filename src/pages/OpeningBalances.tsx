import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, Info, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type TBRow = { account_id: string; debit: number; credit: number };
type APRow = { vendor_id: string; invoice_number: string; invoice_date: string; due_date: string; total_amount: number };
type ARRow = { customer_id: string; invoice_number: string; invoice_date: string; due_date: string; total_amount: number };
type InvRow = { item_id: string; location_id: string; quantity: number; unit_cost: number };
type FARow = {
  asset_code: string; name: string; category_id: string; location_id: string; department_id: string;
  acquisition_date: string; acquisition_cost: number; salvage_value: number; useful_life_years: number;
  depreciation_method: string; accumulated_depreciation: number;
};

export default function OpeningBalances() {
  const [cutoverDate, setCutoverDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Reference data
  const { data: accounts = [] } = useQuery({
    queryKey: ['ob-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name, account_type').order('account_code');
      if (error) throw error; return data as any[];
    },
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ['ob-vendors'],
    queryFn: async () => (await supabase.from('vendors').select('id, name').order('name')).data as any[] || [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['ob-customers'],
    queryFn: async () => (await supabase.from('customers').select('id, name').order('name')).data as any[] || [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ['ob-items'],
    queryFn: async () => (await supabase.from('items').select('id, code, name').order('code')).data as any[] || [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['ob-locations'],
    queryFn: async () => (await supabase.from('locations').select('id, code, name').order('name')).data as any[] || [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['ob-departments'],
    queryFn: async () => (await supabase.from('departments').select('id, name').order('name')).data as any[] || [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['ob-fa-categories'],
    queryFn: async () => (await supabase.from('fixed_asset_categories' as any).select('id, name').order('name')).data as any[] || [],
  });

  // Rows
  const [tb, setTb] = useState<TBRow[]>([]);
  const [ap, setAp] = useState<APRow[]>([]);
  const [ar, setAr] = useState<ARRow[]>([]);
  const [inv, setInv] = useState<InvRow[]>([]);
  const [fa, setFa] = useState<FARow[]>([]);

  const tbTotals = useMemo(() => {
    const d = tb.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const c = tb.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    return { debit: d, credit: c, diff: d - c, balanced: Math.round((d - c) * 100) === 0 && d > 0 };
  }, [tb]);

  async function postTB() {
    if (!tbTotals.balanced) { toast.error('Trial Balance is not balanced'); return; }
    const cleaned = tb.filter(r => r.account_id && (Number(r.debit) || Number(r.credit)))
                     .map(r => ({ account_id: r.account_id, debit: Number(r.debit) || 0, credit: Number(r.credit) || 0, description: 'Opening balance' }));
    const { data, error } = await supabase.rpc('post_opening_trial_balance', { _cutover: cutoverDate, _lines: cleaned as any });
    if (error) { toast.error(error.message); return; }
    toast.success(`Trial Balance posted (JE ${String(data).slice(0, 8)}…)`);
    setTb([]);
  }

  async function importAP() {
    const rows = ap.filter(r => r.vendor_id && r.invoice_number && Number(r.total_amount) > 0);
    if (!rows.length) { toast.error('Add at least one AP invoice row'); return; }
    const { data, error } = await supabase.rpc('import_opening_ap_invoices', { _rows: rows as any });
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${data} open vendor invoices`);
    setAp([]);
  }
  async function importAR() {
    const rows = ar.filter(r => r.customer_id && r.invoice_number && Number(r.total_amount) > 0);
    if (!rows.length) { toast.error('Add at least one AR invoice row'); return; }
    const { data, error } = await supabase.rpc('import_opening_ar_invoices', { _rows: rows as any });
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${data} open customer invoices`);
    setAr([]);
  }
  async function importInv() {
    const rows = inv.filter(r => r.item_id && r.location_id && Number(r.quantity) > 0);
    if (!rows.length) { toast.error('Add at least one inventory row'); return; }
    const { data, error } = await supabase.rpc('import_opening_inventory', { _cutover: cutoverDate, _rows: rows as any });
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${data} inventory rows (with FIFO layers)`);
    setInv([]);
  }
  async function importFA() {
    const rows = fa.filter(r => r.asset_code && r.name && Number(r.acquisition_cost) > 0);
    if (!rows.length) { toast.error('Add at least one asset row'); return; }
    const { data, error } = await supabase.rpc('import_opening_fixed_assets', { _cutover: cutoverDate, _rows: rows as any });
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${data} fixed assets`);
    setFa([]);
  }
  async function lockPeriods() {
    if (!confirm(`Close every fiscal period ending before ${cutoverDate}? This prevents further posting into those periods.`)) return;
    const { data, error } = await supabase.rpc('lock_pre_cutover_periods', { _cutover: cutoverDate });
    if (error) { toast.error(error.message); return; }
    toast.success(`Closed ${data} fiscal period(s) before cutover`);
  }

  return (
    <AppLayout>
      <PageHeader title="Opening Balances / Cutover" description="Load your historical accounting position before go-live." />

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          Set your <b>Cutover Date</b> — the day the system takes over. Everything before it is history. The Trial Balance
          posts a single balanced journal entry dated the day before cutover. Open AP/AR invoices, opening inventory, and the fixed asset register
          are then loaded as reference records only (they do not re-post to the General Ledger, because the Trial Balance already contains their totals).
          When done, click <b>Close Pre-Cutover Periods</b> to lock history.
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cutover Date</CardTitle>
          <CardDescription>The Trial Balance journal entry will be dated the day before this date.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div>
            <Label>Cutover Date</Label>
            <Input type="date" value={cutoverDate} onChange={(e) => setCutoverDate(e.target.value)} className="w-56" />
          </div>
          <Button variant="destructive" onClick={lockPeriods}><Lock className="h-4 w-4 mr-2" />Close Pre-Cutover Periods</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="tb">
        <TabsList>
          <TabsTrigger value="tb">1. Trial Balance</TabsTrigger>
          <TabsTrigger value="ap">2. Open AP Invoices</TabsTrigger>
          <TabsTrigger value="ar">3. Open AR Invoices</TabsTrigger>
          <TabsTrigger value="inv">4. Opening Inventory</TabsTrigger>
          <TabsTrigger value="fa">5. Fixed Assets</TabsTrigger>
        </TabsList>

        {/* Trial Balance */}
        <TabsContent value="tb">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
              <CardDescription>Enter the opening debit or credit balance for each account. Debits must equal credits.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={() => setTb([...tb, { account_id: '', debit: 0, credit: 0 }])}><Plus className="h-4 w-4 mr-1" />Add Line</Button>
                <div className="ml-auto flex gap-6 items-center text-sm">
                  <span>Total DR: <b>{formatCurrency(tbTotals.debit)}</b></span>
                  <span>Total CR: <b>{formatCurrency(tbTotals.credit)}</b></span>
                  <span className={tbTotals.balanced ? 'text-green-600' : 'text-red-600'}>
                    {tbTotals.balanced ? <><CheckCircle2 className="inline h-4 w-4 mr-1" />Balanced</> : `Diff: ${formatCurrency(tbTotals.diff)}`}
                  </span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-40">Debit</TableHead>
                    <TableHead className="w-40">Credit</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tb.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <select className="w-full border rounded px-2 py-1 bg-background" value={r.account_id}
                          onChange={(e) => setTb(tb.map((x, j) => j === i ? { ...x, account_id: e.target.value } : x))}>
                          <option value="">-- select --</option>
                          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.debit || ''} onChange={(e) => setTb(tb.map((x, j) => j === i ? { ...x, debit: Number(e.target.value), credit: 0 } : x))} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.credit || ''} onChange={(e) => setTb(tb.map((x, j) => j === i ? { ...x, credit: Number(e.target.value), debit: 0 } : x))} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setTb(tb.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" disabled={!tbTotals.balanced} onClick={postTB}>Post Trial Balance</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AP Invoices */}
        <TabsContent value="ap">
          <Card>
            <CardHeader>
              <CardTitle>Open Vendor Invoices</CardTitle>
              <CardDescription>Unpaid vendor bills at cutover. These will not re-post to the GL — the AP total is already in the Trial Balance.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => setAp([...ap, { vendor_id: '', invoice_number: '', invoice_date: cutoverDate, due_date: '', total_amount: 0 }])}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
              <Table className="mt-3">
                <TableHeader><TableRow>
                  <TableHead>Vendor</TableHead><TableHead>Invoice #</TableHead><TableHead>Invoice Date</TableHead><TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ap.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><select className="w-full border rounded px-2 py-1 bg-background" value={r.vendor_id} onChange={(e) => setAp(ap.map((x, j) => j === i ? { ...x, vendor_id: e.target.value } : x))}>
                        <option value="">-- select --</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><Input value={r.invoice_number} onChange={(e) => setAp(ap.map((x, j) => j === i ? { ...x, invoice_number: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="date" value={r.invoice_date} onChange={(e) => setAp(ap.map((x, j) => j === i ? { ...x, invoice_date: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="date" value={r.due_date} onChange={(e) => setAp(ap.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.total_amount || ''} onChange={(e) => setAp(ap.map((x, j) => j === i ? { ...x, total_amount: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setAp(ap.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" onClick={importAP} disabled={!ap.length}>Import {ap.length} AP Invoice(s)</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AR Invoices */}
        <TabsContent value="ar">
          <Card>
            <CardHeader>
              <CardTitle>Open Customer Invoices</CardTitle>
              <CardDescription>Unpaid customer invoices at cutover.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => setAr([...ar, { customer_id: '', invoice_number: '', invoice_date: cutoverDate, due_date: '', total_amount: 0 }])}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
              <Table className="mt-3">
                <TableHeader><TableRow>
                  <TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead>Invoice Date</TableHead><TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ar.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><select className="w-full border rounded px-2 py-1 bg-background" value={r.customer_id} onChange={(e) => setAr(ar.map((x, j) => j === i ? { ...x, customer_id: e.target.value } : x))}>
                        <option value="">-- select --</option>{customers.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><Input value={r.invoice_number} onChange={(e) => setAr(ar.map((x, j) => j === i ? { ...x, invoice_number: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="date" value={r.invoice_date} onChange={(e) => setAr(ar.map((x, j) => j === i ? { ...x, invoice_date: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="date" value={r.due_date} onChange={(e) => setAr(ar.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.total_amount || ''} onChange={(e) => setAr(ar.map((x, j) => j === i ? { ...x, total_amount: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setAr(ar.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" onClick={importAR} disabled={!ar.length}>Import {ar.length} AR Invoice(s)</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inv">
          <Card>
            <CardHeader>
              <CardTitle>Opening Inventory</CardTitle>
              <CardDescription>Stock on hand per item/location, with FIFO unit cost. Creates one FIFO cost layer per row.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => setInv([...inv, { item_id: '', location_id: '', quantity: 0, unit_cost: 0 }])}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
              <Table className="mt-3">
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Location</TableHead><TableHead>Quantity</TableHead><TableHead>Unit Cost</TableHead><TableHead>Total</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {inv.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><select className="w-full border rounded px-2 py-1 bg-background" value={r.item_id} onChange={(e) => setInv(inv.map((x, j) => j === i ? { ...x, item_id: e.target.value } : x))}>
                        <option value="">-- select --</option>{items.map((v: any) => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
                      </select></TableCell>
                      <TableCell><select className="w-full border rounded px-2 py-1 bg-background" value={r.location_id} onChange={(e) => setInv(inv.map((x, j) => j === i ? { ...x, location_id: e.target.value } : x))}>
                        <option value="">-- select --</option>{locations.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><Input type="number" step="0.0001" value={r.quantity || ''} onChange={(e) => setInv(inv.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.unit_cost || ''} onChange={(e) => setInv(inv.map((x, j) => j === i ? { ...x, unit_cost: Number(e.target.value) } : x))} /></TableCell>
                      <TableCell>{formatCurrency((Number(r.quantity) || 0) * (Number(r.unit_cost) || 0))}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setInv(inv.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" onClick={importInv} disabled={!inv.length}>Import {inv.length} Inventory Row(s)</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixed Assets */}
        <TabsContent value="fa">
          <Card>
            <CardHeader>
              <CardTitle>Opening Fixed Asset Register</CardTitle>
              <CardDescription>Existing assets with their acquisition cost and accumulated depreciation to date.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => setFa([...fa, {
                asset_code: '', name: '', category_id: '', location_id: '', department_id: '',
                acquisition_date: cutoverDate, acquisition_cost: 0, salvage_value: 0,
                useful_life_years: 5, depreciation_method: 'straight_line', accumulated_depreciation: 0,
              }])}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
              <div className="overflow-x-auto mt-3">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead><TableHead>Dept</TableHead>
                  <TableHead>Acq. Date</TableHead><TableHead>Cost</TableHead><TableHead>Salvage</TableHead><TableHead>Life (yrs)</TableHead>
                  <TableHead>Method</TableHead><TableHead>Accum. Dep</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fa.map((r, i) => {
                    const upd = (p: Partial<FARow>) => setFa(fa.map((x, j) => j === i ? { ...x, ...p } : x));
                    return (
                    <TableRow key={i}>
                      <TableCell><Input value={r.asset_code} onChange={(e) => upd({ asset_code: e.target.value })} className="w-24" /></TableCell>
                      <TableCell><Input value={r.name} onChange={(e) => upd({ name: e.target.value })} className="w-40" /></TableCell>
                      <TableCell><select className="border rounded px-2 py-1 bg-background" value={r.category_id} onChange={(e) => upd({ category_id: e.target.value })}>
                        <option value="">—</option>{categories.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><select className="border rounded px-2 py-1 bg-background" value={r.location_id} onChange={(e) => upd({ location_id: e.target.value })}>
                        <option value="">—</option>{locations.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><select className="border rounded px-2 py-1 bg-background" value={r.department_id} onChange={(e) => upd({ department_id: e.target.value })}>
                        <option value="">—</option>{departments.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select></TableCell>
                      <TableCell><Input type="date" value={r.acquisition_date} onChange={(e) => upd({ acquisition_date: e.target.value })} className="w-40" /></TableCell>
                      <TableCell><Input type="number" value={r.acquisition_cost || ''} onChange={(e) => upd({ acquisition_cost: Number(e.target.value) })} className="w-28" /></TableCell>
                      <TableCell><Input type="number" value={r.salvage_value || ''} onChange={(e) => upd({ salvage_value: Number(e.target.value) })} className="w-24" /></TableCell>
                      <TableCell><Input type="number" value={r.useful_life_years || ''} onChange={(e) => upd({ useful_life_years: Number(e.target.value) })} className="w-20" /></TableCell>
                      <TableCell><select className="border rounded px-2 py-1 bg-background" value={r.depreciation_method} onChange={(e) => upd({ depreciation_method: e.target.value })}>
                        <option value="straight_line">Straight Line</option><option value="reducing_balance">Reducing Balance</option>
                      </select></TableCell>
                      <TableCell><Input type="number" value={r.accumulated_depreciation || ''} onChange={(e) => upd({ accumulated_depreciation: Number(e.target.value) })} className="w-28" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => setFa(fa.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              </div>
              <Button className="mt-4" onClick={importFA} disabled={!fa.length}>Import {fa.length} Asset(s)</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

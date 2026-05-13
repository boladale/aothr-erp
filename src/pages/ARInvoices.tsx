import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Search, Send, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface Customer { id: string; code: string; name: string; payment_terms: number | null; }
interface Item { id: string; code: string; name: string; unit_cost: number | null; }
interface GLAccount { id: string; account_code: string; account_name: string; }
interface InvoiceLine { description: string; item_id: string; quantity: string; unit_price: string; revenue_account_id: string; }
interface ARInvoice {
  id: string; invoice_number: string; customer_id: string; invoice_date: string;
  due_date: string | null; status: string; payment_status: string;
  subtotal: number | null; tax_amount: number | null; total_amount: number | null;
  customers?: { name: string; code: string } | null;
}

export default function ARInvoices() {
  const { hasRole, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ARInvoice | null>(null);
  const [form, setForm] = useState({ customer_id: '', invoice_date: new Date().toISOString().split('T')[0], notes: '', tax_amount: '0' });
  const [lines, setLines] = useState<InvoiceLine[]>([{ description: '', item_id: '', quantity: '1', unit_price: '0', revenue_account_id: '' }]);

  const invoicesQ = useQuery({
    queryKey: ['ar_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_invoices').select('*, customers(name, code)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ARInvoice[];
    },
  });
  const customersQ = useQuery({
    queryKey: ['customers-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('id, code, name, payment_terms').eq('is_active', true);
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });
  const itemsQ = useQuery({
    queryKey: ['items-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('id, code, name, unit_cost').eq('is_active', true);
      if (error) throw error;
      return (data || []) as Item[];
    },
  });
  const revenueAccountsQ = useQuery({
    queryKey: ['gl-revenue-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name').eq('account_type', 'revenue').eq('is_active', true).eq('is_header', false);
      if (error) throw error;
      return (data || []) as GLAccount[];
    },
  });
  const invoices = invoicesQ.data || [];
  const customers = customersQ.data || [];
  const items = itemsQ.data || [];
  const revenueAccounts = revenueAccountsQ.data || [];
  const loading = invoicesQ.isLoading;

  const openEditDialog = async (inv: ARInvoice) => {
    setEditingInvoice(inv);
    setForm({ customer_id: inv.customer_id, invoice_date: inv.invoice_date, notes: '', tax_amount: String(inv.tax_amount || 0) });
    const { data: invLines } = await supabase.from('ar_invoice_lines').select('*').eq('invoice_id', inv.id);
    setLines((invLines || []).map((l: any) => ({
      description: l.description, item_id: l.item_id || '', quantity: String(l.quantity),
      unit_price: String(l.unit_price), revenue_account_id: l.revenue_account_id || '',
    })));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setForm({ customer_id: '', invoice_date: new Date().toISOString().split('T')[0], notes: '', tax_amount: '0' });
    setLines([{ description: '', item_id: '', quantity: '1', unit_price: '0', revenue_account_id: '' }]);
  };

  const addLine = () => setLines([...lines, { description: '', item_id: '', quantity: '1', unit_price: '0', revenue_account_id: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof InvoiceLine, value: string) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    if (field === 'item_id') {
      const item = items.find(it => it.id === value);
      if (item) { updated[i].unit_price = String(item.unit_cost || 0); updated[i].description = item.name; }
    }
    setLines(updated);
  };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
  const tax = parseFloat(form.tax_amount) || 0;
  const total = subtotal + tax;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const customer = customers.find(c => c.id === form.customer_id);
      const dueDate = new Date(form.invoice_date);
      dueDate.setDate(dueDate.getDate() + (customer?.payment_terms || 30));

      if (editingInvoice) {
        const { error } = await supabase.from('ar_invoices').update({
          customer_id: form.customer_id, invoice_date: form.invoice_date,
          due_date: dueDate.toISOString().split('T')[0], subtotal, tax_amount: tax, total_amount: total,
        }).eq('id', editingInvoice.id);
        if (error) throw error;
        await supabase.from('ar_invoice_lines').delete().eq('invoice_id', editingInvoice.id);
        await supabase.from('ar_invoice_lines').insert(lines.map(l => ({
          invoice_id: editingInvoice.id, item_id: l.item_id || null, description: l.description,
          quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
          revenue_account_id: l.revenue_account_id || null,
        })));
        return 'updated';
      } else {
        const invNum = await getNextTransactionNumber(organizationId!, 'AR_INV', 'INV');
        const { data: inv, error } = await supabase.from('ar_invoices').insert({
          invoice_number: invNum, customer_id: form.customer_id, invoice_date: form.invoice_date,
          due_date: dueDate.toISOString().split('T')[0], subtotal, tax_amount: tax, total_amount: total,
          notes: form.notes || null, organization_id: organizationId,
        }).select().single();
        if (error) throw error;
        await supabase.from('ar_invoice_lines').insert(lines.map(l => ({
          invoice_id: inv.id, item_id: l.item_id || null, description: l.description,
          quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
          revenue_account_id: l.revenue_account_id || null,
        })));
        return 'created';
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ar_invoices'] });
      setDialogOpen(false);
      resetForm();
      toast.success(`Invoice ${res}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!form.customer_id) { toast.error('Select a customer'); return; }
    if (lines.some(l => !l.description)) { toast.error('All lines need a description'); return; }
    saveMutation.mutate();
  };

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ar_invoices').update({ status: 'posted' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar_invoices'] });
      toast.success('Invoice posted to GL');
    },
    onError: (err: any) => toast.error(err.message),
  });
  const handlePost = (id: string) => postMutation.mutate(id);

  const filtered = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const paymentStatusColors: Record<string, string> = {
    unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
    partial: 'bg-warning/10 text-warning border-warning/20',
    paid: 'bg-success/10 text-success border-success/20',
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AR Invoices" description="Create and manage sales invoices"
          actions={canManage ? (
            <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>
          ) : undefined} />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 max-w-sm" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Payment</th>
                    {canManage && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 text-sm">{inv.customers?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{inv.invoice_date}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{inv.due_date || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(inv.total_amount || 0)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={paymentStatusColors[inv.payment_status] || ''}>{inv.payment_status}</Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {inv.status === 'draft' && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(inv)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="outline" size="sm" onClick={() => handlePost(inv.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No invoices found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingInvoice ? 'Edit Sales Invoice' : 'New Sales Invoice'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customer_id || 'none'} onValueChange={v => setForm(f => ({ ...f, customer_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select customer...</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></div>
              </div>

              <Card>
                <CardHeader className="py-3"><CardTitle className="text-sm">Line Items</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        {i === 0 && <Label className="text-xs">Item</Label>}
                        <Select value={line.item_id || 'none'} onValueChange={v => updateLine(i, 'item_id', v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Custom line</SelectItem>
                            {items.map(it => <SelectItem key={it.id} value={it.id}>{it.code} - {it.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">{i === 0 && <Label className="text-xs">Description</Label>}<Input className="h-9" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
                      <div className="col-span-1">{i === 0 && <Label className="text-xs">Qty</Label>}<Input className="h-9" type="number" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></div>
                      <div className="col-span-2">{i === 0 && <Label className="text-xs">Unit Price</Label>}<Input className="h-9" type="number" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} /></div>
                      <div className="col-span-2">
                        {i === 0 && <Label className="text-xs">Revenue Acct</Label>}
                        <Select value={line.revenue_account_id || 'default'} onValueChange={v => updateLine(i, 'revenue_account_id', v === 'default' ? '' : v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Default" /></SelectTrigger>
                          <SelectContent><SelectItem value="default">Default (4100)</SelectItem>{revenueAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">{lines.length > 1 && <Button variant="ghost" size="sm" className="h-9" onClick={() => removeLine(i)}>×</Button>}</div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <div><Label>Tax Amount</Label><Input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} /></div>
                <div className="text-right pt-6"><span className="text-sm text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</span></div>
                <div className="text-right pt-6"><span className="font-semibold">Total: {formatCurrency(total)}</span></div>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : (editingInvoice ? 'Update Invoice' : 'Create Invoice')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

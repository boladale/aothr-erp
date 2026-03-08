import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface Customer { id: string; code: string; name: string; }
interface ARInvoice { id: string; invoice_number: string; total_amount: number; }
interface CreditNoteLine { description: string; quantity: string; unit_price: string; }
interface ARCreditNote {
  id: string; credit_note_number: string; customer_id: string; invoice_id: string | null;
  credit_date: string; status: string; total_amount: number | null; reason: string | null;
  customers?: { name: string; code: string } | null;
  ar_invoices?: { invoice_number: string } | null;
}

export default function ARCreditNotes() {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [creditNotes, setCreditNotes] = useState<ARCreditNote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<ARInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', invoice_id: '', credit_date: new Date().toISOString().split('T')[0], reason: '' });
  const [lines, setLines] = useState<CreditNoteLine[]>([{ description: '', quantity: '1', unit_price: '0' }]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [cnRes, custRes] = await Promise.all([
      supabase.from('ar_credit_notes').select('*, customers(name, code), ar_invoices(invoice_number)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, code, name').eq('is_active', true),
    ]);
    setCreditNotes((cnRes.data || []) as ARCreditNote[]);
    setCustomers((custRes.data || []) as Customer[]);
    setLoading(false);
  };

  const onCustomerChange = async (customerId: string) => {
    setForm(f => ({ ...f, customer_id: customerId, invoice_id: '' }));
    if (!customerId) { setCustomerInvoices([]); return; }
    const { data } = await supabase.from('ar_invoices')
      .select('id, invoice_number, total_amount')
      .eq('customer_id', customerId).eq('status', 'posted');
    setCustomerInvoices((data || []) as ARInvoice[]);
  };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const handleCreate = async () => {
    if (!form.customer_id) { toast.error('Select a customer'); return; }
    if (lines.some(l => !l.description)) { toast.error('All lines need a description'); return; }

    const cnNum = `CN-${Date.now().toString(36).toUpperCase()}`;
    
    const { data: cn, error: cnErr } = await supabase.from('ar_credit_notes').insert({
      credit_note_number: cnNum, customer_id: form.customer_id,
      invoice_id: form.invoice_id || null, credit_date: form.credit_date,
      subtotal, total_amount: subtotal, reason: form.reason || null,
    }).select().single();
    
    if (cnErr) { toast.error(cnErr.message); return; }

    const lineInserts = lines.map(l => ({
      credit_note_id: cn.id, description: l.description,
      quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
    }));
    
    await supabase.from('ar_credit_note_lines').insert(lineInserts);

    toast.success('Credit note created');
    setDialogOpen(false);
    setForm({ customer_id: '', invoice_id: '', credit_date: new Date().toISOString().split('T')[0], reason: '' });
    setLines([{ description: '', quantity: '1', unit_price: '0' }]);
    fetchAll();
  };

  const handlePost = async (id: string) => {
    const { error } = await supabase.from('ar_credit_notes').update({ status: 'posted' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Credit note posted to GL');
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Credit Notes"
          description="Issue credit memos and process refunds"
          actions={canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Credit Note</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Credit Note</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id || 'none'} onValueChange={v => onCustomerChange(v === 'none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select customer...</SelectItem>
                          {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Against Invoice (optional)</Label>
                      <Select value={form.invoice_id || 'none'} onValueChange={v => setForm(f => ({ ...f, invoice_id: v === 'none' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No linked invoice</SelectItem>
                          {customerInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} ({formatCurrency(inv.total_amount)})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Credit Date</Label><Input type="date" value={form.credit_date} onChange={e => setForm(f => ({ ...f, credit_date: e.target.value }))} /></div>
                  </div>
                  <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>

                  <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm">Lines</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {lines.map((line, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-6">
                            {i === 0 && <Label className="text-xs">Description</Label>}
                            <Input className="h-9" value={line.description} onChange={e => {
                              const u = [...lines]; u[i] = { ...u[i], description: e.target.value }; setLines(u);
                            }} />
                          </div>
                          <div className="col-span-2">
                            {i === 0 && <Label className="text-xs">Qty</Label>}
                            <Input className="h-9" type="number" value={line.quantity} onChange={e => {
                              const u = [...lines]; u[i] = { ...u[i], quantity: e.target.value }; setLines(u);
                            }} />
                          </div>
                          <div className="col-span-3">
                            {i === 0 && <Label className="text-xs">Unit Price</Label>}
                            <Input className="h-9" type="number" value={line.unit_price} onChange={e => {
                              const u = [...lines]; u[i] = { ...u[i], unit_price: e.target.value }; setLines(u);
                            }} />
                          </div>
                          <div className="col-span-1">
                            {lines.length > 1 && <Button variant="ghost" size="sm" className="h-9" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>×</Button>}
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: '', quantity: '1', unit_price: '0' }])}>+ Add Line</Button>
                      <div className="pt-2 text-right font-semibold">Total: {formatCurrency(subtotal)}</div>
                    </CardContent>
                  </Card>

                  <Button onClick={handleCreate} className="w-full">Create Credit Note</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined}
        />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Credit Note #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    {canManage && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {creditNotes.map(cn => (
                    <tr key={cn.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{cn.credit_note_number}</td>
                      <td className="px-4 py-2.5 text-sm">{cn.customers?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground">{cn.ar_invoices?.invoice_number || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{cn.credit_date}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(cn.total_amount || 0)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={cn.status} /></td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          {cn.status === 'draft' && (
                            <Button variant="outline" size="sm" onClick={() => handlePost(cn.id)}>
                              <Send className="h-3 w-3 mr-1" /> Post
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {creditNotes.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No credit notes found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

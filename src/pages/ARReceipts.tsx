import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Send, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface Customer { id: string; code: string; name: string; }
interface OutstandingInvoice { id: string; invoice_number: string; total_amount: number; payment_status: string; outstanding: number; }
interface Allocation { invoice_id: string; amount: string; }
interface ARReceipt {
  id: string; receipt_number: string; customer_id: string; receipt_date: string;
  total_amount: number; payment_method: string; reference_number: string | null; notes: string | null; status: string;
  customers?: { name: string; code: string } | null;
}

export default function ARReceipts() {
  const { hasRole, organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [receipts, setReceipts] = useState<ARReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ARReceipt | null>(null);
  const [form, setForm] = useState({ customer_id: '', receipt_date: new Date().toISOString().split('T')[0], payment_method: 'bank_transfer', reference_number: '', notes: '' });
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [recRes, custRes] = await Promise.all([
      supabase.from('ar_receipts').select('*, customers(name, code)').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, code, name').eq('is_active', true),
    ]);
    setReceipts((recRes.data || []) as ARReceipt[]);
    setCustomers((custRes.data || []) as Customer[]);
    setLoading(false);
  };

  const openEditDialog = async (rec: ARReceipt) => {
    setEditingReceipt(rec);
    setForm({ customer_id: rec.customer_id, receipt_date: rec.receipt_date, payment_method: rec.payment_method, reference_number: rec.reference_number || '', notes: rec.notes || '' });
    // Load existing allocations
    const { data: existingAllocs } = await supabase.from('ar_receipt_allocations').select('invoice_id, allocated_amount').eq('receipt_id', rec.id);
    await loadOutstandingInvoices(rec.customer_id, existingAllocs || []);
    setDialogOpen(true);
  };

  const loadOutstandingInvoices = async (customerId: string, existingAllocs: any[] = []) => {
    const { data: invs } = await supabase.from('ar_invoices')
      .select('id, invoice_number, total_amount, payment_status')
      .eq('customer_id', customerId).eq('status', 'posted').in('payment_status', ['unpaid', 'partial']);
    // Also include invoices from existing allocs
    const existingInvIds = existingAllocs.map((a: any) => a.invoice_id);
    let extraInvs: any[] = [];
    if (existingInvIds.length > 0) {
      const { data } = await supabase.from('ar_invoices').select('id, invoice_number, total_amount, payment_status').in('id', existingInvIds);
      extraInvs = data || [];
    }
    const allInvs = new Map<string, any>();
    [...(invs || []), ...extraInvs].forEach((inv: any) => allInvs.set(inv.id, inv));

    const { data: allAllocs } = await supabase.from('ar_receipt_allocations')
      .select('invoice_id, allocated_amount, ar_receipts!inner(status)')
      .in('invoice_id', Array.from(allInvs.keys()));

    const existingAllocMap = new Map(existingAllocs.map((a: any) => [a.invoice_id, a.allocated_amount]));

    const outstanding = Array.from(allInvs.values()).map((inv: any) => {
      const paid = (allAllocs || [])
        .filter((a: any) => a.invoice_id === inv.id && a.ar_receipts?.status === 'posted')
        .reduce((s: number, a: any) => s + (a.allocated_amount || 0), 0);
      const existingAlloc = existingAllocMap.get(inv.id) || 0;
      return { ...inv, total_amount: inv.total_amount || 0, outstanding: (inv.total_amount || 0) - paid + existingAlloc };
    }).filter((inv: any) => inv.outstanding > 0);

    setOutstandingInvoices(outstanding);
    setAllocations(outstanding.map((inv: any) => ({
      invoice_id: inv.id, amount: existingAllocMap.has(inv.id) ? String(existingAllocMap.get(inv.id)) : '',
    })));
  };

  const onCustomerChange = async (customerId: string) => {
    setForm(f => ({ ...f, customer_id: customerId }));
    if (!customerId) { setOutstandingInvoices([]); setAllocations([]); return; }
    await loadOutstandingInvoices(customerId);
  };

  const totalAllocated = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  const handleSave = async () => {
    if (!form.customer_id) { toast.error('Select a customer'); return; }
    if (totalAllocated <= 0) { toast.error('Allocate at least one payment'); return; }

    if (editingReceipt) {
      const { error } = await supabase.from('ar_receipts').update({
        receipt_date: form.receipt_date, total_amount: totalAllocated,
        payment_method: form.payment_method, reference_number: form.reference_number || null, notes: form.notes || null,
      }).eq('id', editingReceipt.id);
      if (error) { toast.error(error.message); return; }
      await supabase.from('ar_receipt_allocations').delete().eq('receipt_id', editingReceipt.id);
      const allocInserts = allocations.filter(a => parseFloat(a.amount) > 0).map(a => ({
        receipt_id: editingReceipt.id, invoice_id: a.invoice_id, allocated_amount: parseFloat(a.amount),
      }));
      await supabase.from('ar_receipt_allocations').insert(allocInserts);
      toast.success('Receipt updated');
    } else {
      const recNum = await getNextTransactionNumber(organizationId!, 'REC', 'REC');
      const { data: rec, error } = await supabase.from('ar_receipts').insert({
        receipt_number: recNum, customer_id: form.customer_id, receipt_date: form.receipt_date,
        total_amount: totalAllocated, payment_method: form.payment_method,
        reference_number: form.reference_number || null, notes: form.notes || null, organization_id: organizationId,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      const allocInserts = allocations.filter(a => parseFloat(a.amount) > 0).map(a => ({
        receipt_id: rec.id, invoice_id: a.invoice_id, allocated_amount: parseFloat(a.amount),
      }));
      await supabase.from('ar_receipt_allocations').insert(allocInserts);
      toast.success('Receipt created');
    }
    setDialogOpen(false);
    resetForm();
    fetchAll();
  };

  const resetForm = () => {
    setEditingReceipt(null);
    setForm({ customer_id: '', receipt_date: new Date().toISOString().split('T')[0], payment_method: 'bank_transfer', reference_number: '', notes: '' });
    setAllocations([]); setOutstandingInvoices([]);
  };

  const handlePost = async (id: string) => {
    const { error } = await supabase.from('ar_receipts').update({ status: 'posted' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Receipt posted to GL');
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AR Receipts" description="Record customer payments and allocate to invoices"
          actions={canManage ? <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Receipt</Button> : undefined} />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Receipt #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Method</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    {canManage && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm font-mono">{rec.receipt_number}</td>
                      <td className="px-4 py-2.5 text-sm">{rec.customers?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{rec.receipt_date}</td>
                      <td className="px-4 py-2.5 text-sm capitalize">{rec.payment_method.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(rec.total_amount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={rec.status} /></td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          {rec.status === 'draft' && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(rec)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handlePost(rec.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {receipts.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No receipts found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingReceipt ? 'Edit Customer Receipt' : 'New Customer Receipt'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer</Label>
                  {editingReceipt ? (
                    <Input value={customers.find(c => c.id === form.customer_id)?.name || ''} disabled />
                  ) : (
                    <Select value={form.customer_id || 'none'} onValueChange={v => onCustomerChange(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select customer...</SelectItem>
                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div><Label>Receipt Date</Label><Input type="date" value={form.receipt_date} onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Reference #</Label><Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} /></div>
              </div>

              {outstandingInvoices.length > 0 && (
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Allocate to Invoices</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {outstandingInvoices.map((inv, i) => (
                      <div key={inv.id} className="flex items-center gap-4">
                        <span className="text-sm font-mono w-36">{inv.invoice_number}</span>
                        <span className="text-sm text-muted-foreground w-28">Outstanding: {formatCurrency(inv.outstanding)}</span>
                        <Input type="number" className="h-9 w-32" placeholder="Amount" value={allocations[i]?.amount || ''} max={inv.outstanding}
                          onChange={e => { const updated = [...allocations]; updated[i] = { ...updated[i], amount: e.target.value }; setAllocations(updated); }} />
                      </div>
                    ))}
                    <div className="pt-2 text-right font-semibold">Total: {formatCurrency(totalAllocated)}</div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleSave} className="w-full">{editingReceipt ? 'Update Receipt' : 'Create Receipt'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

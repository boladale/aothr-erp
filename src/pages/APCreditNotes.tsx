import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { Plus, Send, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';
import { DeleteDraftButton } from '@/components/ui/delete-draft-button';

interface Vendor { id: string; code: string; name: string; }
interface APInvoice { id: string; invoice_number: string; total_amount: number; }
interface CreditNoteLine { description: string; quantity: string; unit_price: string; }
interface APCreditNote {
  id: string; credit_note_number: string; vendor_id: string; invoice_id: string | null;
  credit_date: string; status: string; total_amount: number | null; reason: string | null;
  vendors?: { name: string; code: string } | null;
  ap_invoices?: { invoice_number: string } | null;
}

export default function APCreditNotes() {
  const { hasRole, organizationId } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [vendorInvoices, setVendorInvoices] = useState<APInvoice[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCN, setEditingCN] = useState<APCreditNote | null>(null);
  const [form, setForm] = useState({ vendor_id: '', invoice_id: '', credit_date: new Date().toISOString().split('T')[0], reason: '' });
  const [lines, setLines] = useState<CreditNoteLine[]>([{ description: '', quantity: '1', unit_price: '0' }]);

  const dataQ = useQuery({
    queryKey: ['ap_credit_notes'],
    queryFn: async () => {
      const [cnRes, venRes] = await Promise.all([
        (supabase as any).from('ap_credit_notes').select('*, vendors(name, code), ap_invoices(invoice_number)').order('created_at', { ascending: false }),
        supabase.from('vendors').select('id, code, name').eq('status', 'active'),
      ]);
      return { creditNotes: (cnRes.data || []) as APCreditNote[], vendors: (venRes.data || []) as Vendor[] };
    },
  });
  const creditNotes = dataQ.data?.creditNotes || [];
  const vendors = dataQ.data?.vendors || [];
  const loading = dataQ.isLoading;
  const fetchAll = () => qc.invalidateQueries({ queryKey: ['ap_credit_notes'] });

  const onVendorChange = async (vendorId: string) => {
    setForm(f => ({ ...f, vendor_id: vendorId, invoice_id: '' }));
    if (!vendorId) { setVendorInvoices([]); return; }
    const { data } = await supabase.from('ap_invoices').select('id, invoice_number, total_amount').eq('vendor_id', vendorId).eq('status', 'posted');
    setVendorInvoices((data || []) as APInvoice[]);
  };

  const openEditDialog = async (cn: APCreditNote) => {
    setEditingCN(cn);
    setForm({ vendor_id: cn.vendor_id, invoice_id: cn.invoice_id || '', credit_date: cn.credit_date, reason: cn.reason || '' });
    const { data: invs } = await supabase.from('ap_invoices').select('id, invoice_number, total_amount').eq('vendor_id', cn.vendor_id).eq('status', 'posted');
    setVendorInvoices((invs || []) as APInvoice[]);
    const { data: cnLines } = await (supabase as any).from('ap_credit_note_lines').select('*').eq('credit_note_id', cn.id);
    setLines((cnLines || []).map((l: any) => ({ description: l.description, quantity: String(l.quantity), unit_price: String(l.unit_price) })));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCN(null);
    setForm({ vendor_id: '', invoice_id: '', credit_date: new Date().toISOString().split('T')[0], reason: '' });
    setLines([{ description: '', quantity: '1', unit_price: '0' }]);
  };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const handleSave = async () => {
    if (!form.vendor_id) { toast.error('Select a vendor'); return; }
    if (lines.some(l => !l.description)) { toast.error('All lines need a description'); return; }

    if (editingCN) {
      const { error } = await (supabase as any).from('ap_credit_notes').update({
        vendor_id: form.vendor_id, invoice_id: form.invoice_id || null,
        credit_date: form.credit_date, subtotal, total_amount: subtotal, reason: form.reason || null,
      }).eq('id', editingCN.id);
      if (error) { toast.error(error.message); return; }
      await (supabase as any).from('ap_credit_note_lines').delete().eq('credit_note_id', editingCN.id);
      await (supabase as any).from('ap_credit_note_lines').insert(lines.map(l => ({
        credit_note_id: editingCN.id, description: l.description,
        quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
      })));
      toast.success('Credit note updated');
    } else {
      const cnNum = await getNextTransactionNumber(organizationId!, 'APCN', 'APCN');
      const { data: cn, error } = await (supabase as any).from('ap_credit_notes').insert({
        credit_note_number: cnNum, vendor_id: form.vendor_id, invoice_id: form.invoice_id || null,
        credit_date: form.credit_date, subtotal, total_amount: subtotal, reason: form.reason || null, organization_id: organizationId,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      await (supabase as any).from('ap_credit_note_lines').insert(lines.map((l: any) => ({
        credit_note_id: cn.id, description: l.description,
        quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0,
      })));
      toast.success('Credit note created');
    }
    setDialogOpen(false);
    resetForm();
    fetchAll();
  };

  const handlePost = async (id: string) => {
    const { error } = await (supabase as any).from('ap_credit_notes').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Credit note posted');
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Vendor Credit Notes" description="Vendor debit memos to offset AP invoices"
          actions={canManage ? <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Credit Note</Button> : undefined} />

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Credit Note #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Vendor</th>
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
                      <td className="px-4 py-2.5 text-sm">{cn.vendors?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-muted-foreground">{cn.ap_invoices?.invoice_number || '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{cn.credit_date}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{formatCurrency(cn.total_amount || 0)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={cn.status} /></td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {cn.status === 'draft' && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(cn)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="outline" size="sm" onClick={() => handlePost(cn.id)}><Send className="h-3 w-3 mr-1" /> Post</Button>
                              </>
                            )}
                            <DeleteDraftButton
                              table={'ap_credit_notes' as any}
                              childTable={'ap_credit_note_lines' as any}
                              childKey="credit_note_id"
                              id={cn.id}
                              status={cn.status}
                              label={`Credit Note ${cn.credit_note_number || ''}`.trim()}
                              onDeleted={fetchAll}
                            />
                          </div>
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

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingCN ? 'Edit Credit Note' : 'New Vendor Credit Note'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor</Label>
                  {editingCN ? (
                    <Input value={vendors.find(v => v.id === form.vendor_id)?.name || ''} disabled />
                  ) : (
                    <Select value={form.vendor_id || 'none'} onValueChange={v => onVendorChange(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select vendor...</SelectItem>
                        {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Against Invoice (optional)</Label>
                  <Select value={form.invoice_id || 'none'} onValueChange={v => setForm(f => ({ ...f, invoice_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked invoice</SelectItem>
                      {vendorInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} ({formatCurrency(inv.total_amount)})</SelectItem>)}
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
                      <div className="col-span-6">{i === 0 && <Label className="text-xs">Description</Label>}<Input className="h-9" value={line.description} onChange={e => { const u = [...lines]; u[i] = { ...u[i], description: e.target.value }; setLines(u); }} /></div>
                      <div className="col-span-2">{i === 0 && <Label className="text-xs">Qty</Label>}<Input className="h-9" type="number" value={line.quantity} onChange={e => { const u = [...lines]; u[i] = { ...u[i], quantity: e.target.value }; setLines(u); }} /></div>
                      <div className="col-span-3">{i === 0 && <Label className="text-xs">Unit Price</Label>}<Input className="h-9" type="number" value={line.unit_price} onChange={e => { const u = [...lines]; u[i] = { ...u[i], unit_price: e.target.value }; setLines(u); }} /></div>
                      <div className="col-span-1">{lines.length > 1 && <Button variant="ghost" size="sm" className="h-9" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>×</Button>}</div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: '', quantity: '1', unit_price: '0' }])}>+ Add Line</Button>
                  <div className="pt-2 text-right font-semibold">Total: {formatCurrency(subtotal)}</div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} className="w-full">{editingCN ? 'Update Credit Note' : 'Create Credit Note'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

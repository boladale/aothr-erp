import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, CreditCard, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_status: string;
}

export default function APPayments() {
  const { toast: showToast } = useToast();
  const { hasRole } = useAuth();
  const { organizationId } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable') || hasRole('ap_clerk');

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ap_payments')
      .select('*, vendor:vendors(name, code)')
      .order('created_at', { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  const openCreateDialog = async () => {
    const { data } = await supabase.from('vendors').select('id, name, code').eq('status', 'active').order('name');
    setVendors(data || []);
    setSelectedVendor('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('bank_transfer');
    setReferenceNumber('');
    setNotes('');
    setVendorInvoices([]);
    setAllocations({});
    setSelectedInvoices(new Set());
    setDialogOpen(true);
  };

  const onVendorChange = async (vendorId: string) => {
    setSelectedVendor(vendorId);
    setAllocations({});
    setSelectedInvoices(new Set());
    const { data } = await supabase
      .from('ap_invoices')
      .select('id, invoice_number, total_amount, payment_status')
      .eq('vendor_id', vendorId)
      .eq('status', 'posted')
      .in('payment_status', ['unpaid', 'partial']);
    setVendorInvoices(data || []);
  };

  const toggleInvoice = (invoiceId: string, checked: boolean) => {
    const next = new Set(selectedInvoices);
    if (checked) {
      next.add(invoiceId);
      const inv = vendorInvoices.find(i => i.id === invoiceId);
      if (inv) setAllocations(prev => ({ ...prev, [invoiceId]: inv.total_amount || 0 }));
    } else {
      next.delete(invoiceId);
      setAllocations(prev => { const n = { ...prev }; delete n[invoiceId]; return n; });
    }
    setSelectedInvoices(next);
  };

  const totalAmount = Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);

  const handleCreate = async () => {
    if (!selectedVendor || selectedInvoices.size === 0 || totalAmount <= 0) {
      toast({ title: 'Error', description: 'Select a vendor and at least one invoice.', variant: 'destructive' });
      return;
    }
    const payNum = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const { data: payment, error: payErr } = await supabase
      .from('ap_payments')
      .insert({
        payment_number: payNum,
        vendor_id: selectedVendor,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        total_amount: totalAmount,
        notes: notes || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        organization_id: organizationId,
      })
      .select()
      .single();

    if (payErr) { toast({ title: 'Error', description: payErr.message, variant: 'destructive' }); return; }

    const allocationRows = Array.from(selectedInvoices).map(invoiceId => ({
      payment_id: payment.id,
      invoice_id: invoiceId,
      allocated_amount: allocations[invoiceId] || 0,
    }));
    const { error: allocErr } = await supabase.from('ap_payment_allocations').insert(allocationRows);
    if (allocErr) { toast({ title: 'Error', description: allocErr.message, variant: 'destructive' }); return; }

    toast({ title: 'Payment created', description: `${payNum} created as draft.` });
    setDialogOpen(false);
    fetchPayments();
  };

  const handlePost = async (paymentId: string, paymentNumber: string) => {
    setPosting(true);
    const { error } = await supabase.from('ap_payments').update({ status: 'posted' }).eq('id', paymentId);
    if (error) {
      toast({ title: 'Post failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payment posted', description: `${paymentNumber} posted and GL entry created.` });
      fetchPayments();
    }
    setPosting(false);
  };

  const columns = [
    { key: 'payment_number', header: 'Payment #' },
    { key: 'vendor', header: 'Vendor', render: (item: any) => (item.vendor as any)?.name || '-' },
    { key: 'payment_date', header: 'Date' },
    { key: 'payment_method', header: 'Method', render: (item: any) => item.payment_method?.replace('_', ' ') },
    { key: 'total_amount', header: 'Amount', render: (item: any) => formatCurrency(item.total_amount || 0) },
    { key: 'status', header: 'Status', render: (item: any) => <StatusBadge status={item.status} /> },
    ...(canManage ? [{
      key: 'actions',
      header: 'Actions',
      render: (item: any) => item.status === 'draft' ? (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handlePost(item.id, item.payment_number); }} disabled={posting}>
          <Send className="h-3 w-3 mr-1" /> Post
        </Button>
      ) : null,
    }] : []),
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="AP Payments"
          description="Manage vendor payments and track allocations against invoices."
          actions={canManage ? <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" /> New Payment</Button> : undefined}
        />
        {loading ? <Skeleton className="h-64" /> : (
          <Card><CardContent className="p-0"><DataTable columns={columns} data={payments} /></CardContent></Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Create Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select value={selectedVendor} onValueChange={onVendorChange}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g. cheque number" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
              {selectedVendor && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Allocate to Invoices</Label>
                  {vendorInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No outstanding invoices for this vendor.</p>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {vendorInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center gap-4 p-3">
                          <Checkbox checked={selectedInvoices.has(inv.id)} onCheckedChange={(checked) => toggleInvoice(inv.id, !!checked)} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{inv.invoice_number}</p>
                            <p className="text-xs text-muted-foreground">Total: {formatCurrency(inv.total_amount || 0)} • {inv.payment_status}</p>
                          </div>
                          {selectedInvoices.has(inv.id) && (
                            <Input type="number" className="w-32" value={allocations[inv.id] || ''} onChange={e => setAllocations(prev => ({ ...prev, [inv.id]: parseFloat(e.target.value) || 0 }))} step="0.01" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {totalAmount > 0 && <p className="text-right font-semibold">Total: {formatCurrency(totalAmount)}</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={selectedInvoices.size === 0}>Create Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, Receipt, DollarSign, Clock, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface VendorInfo {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  status: string | null;
}

interface ContractRow {
  id: string;
  po_number: string;
  status: string;
  order_date: string | null;
  total_amount: number;
  progress: number;
  qty_ordered: number;
  qty_received: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  status: string;
  payment_status: string;
  is_overdue: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ChairmanVendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { baseCurrency } = useOrgCurrency();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    if (id) load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async (vendorId: string) => {
    setLoading(true);
    try {
      const today = todayISO();
      const [vRes, poRes, invRes] = await Promise.all([
        supabase.from('vendors').select('id, name, code, email, phone, status').eq('id', vendorId).maybeSingle(),
        supabase.from('purchase_orders').select('id, po_number, status, order_date, total_amount').eq('vendor_id', vendorId).order('order_date', { ascending: false }),
        supabase.from('ap_invoices').select('id, invoice_number, invoice_date, due_date, total_amount, status, payment_status').eq('vendor_id', vendorId).order('invoice_date', { ascending: false }),
      ]);

      setVendor(vRes.data as any);

      const pos = poRes.data || [];
      const poIds = pos.map(p => p.id);
      const linesByPo: Record<string, { ord: number; rec: number }> = {};
      if (poIds.length) {
        const { data: lines } = await supabase
          .from('purchase_order_lines')
          .select('po_id, quantity, qty_received')
          .in('po_id', poIds);
        (lines || []).forEach((l: any) => {
          const t = linesByPo[l.po_id] || { ord: 0, rec: 0 };
          t.ord += Number(l.quantity || 0);
          t.rec += Number(l.qty_received || 0);
          linesByPo[l.po_id] = t;
        });
      }

      setContracts(pos.map((p: any) => {
        const t = linesByPo[p.id] || { ord: 0, rec: 0 };
        return {
          id: p.id,
          po_number: p.po_number,
          status: p.status,
          order_date: p.order_date,
          total_amount: Number(p.total_amount || 0),
          progress: t.ord > 0 ? Math.min(100, (t.rec / t.ord) * 100) : 0,
          qty_ordered: t.ord,
          qty_received: t.rec,
        };
      }));

      const invs = invRes.data || [];
      const invIds = invs.map(i => i.id);
      const paidByInvoice: Record<string, number> = {};
      if (invIds.length) {
        const { data: allocs } = await supabase
          .from('ap_payment_allocations')
          .select('invoice_id, allocated_amount')
          .in('invoice_id', invIds);
        (allocs || []).forEach((a: any) => {
          paidByInvoice[a.invoice_id] = (paidByInvoice[a.invoice_id] || 0) + Number(a.allocated_amount || 0);
        });
      }

      setInvoices(invs.map((i: any) => {
        const total = Number(i.total_amount || 0);
        const paid = paidByInvoice[i.id] || 0;
        const outstanding = Math.max(0, total - paid);
        return {
          id: i.id,
          invoice_number: i.invoice_number,
          invoice_date: i.invoice_date,
          due_date: i.due_date,
          total_amount: total,
          paid_amount: paid,
          outstanding,
          status: i.status,
          payment_status: i.payment_status,
          is_overdue: !!(i.due_date && i.due_date < today && outstanding > 0),
        };
      }));
    } catch (e) {
      console.error('Vendor detail error', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => formatCurrency(v, baseCurrency);

  const totalValue = contracts.reduce((s, c) => s + c.total_amount, 0);
  const activeContracts = contracts.filter(c => !['closed', 'cancelled', 'draft'].includes(c.status)).length;
  const totalDue = invoices.reduce((s, i) => s + i.outstanding, 0);
  const overdueCount = invoices.filter(i => i.is_overdue).length;
  const avgProgress = contracts.length ? contracts.reduce((s, c) => s + c.progress, 0) / contracts.length : 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container space-y-6">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (!vendor) {
    return (
      <AppLayout>
        <div className="page-container">
          <Button variant="ghost" onClick={() => navigate('/chairman-dashboard')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Card><CardContent className="p-12 text-center text-muted-foreground">Vendor not found.</CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <Button variant="ghost" onClick={() => navigate('/chairman-dashboard')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Chairman Dashboard
        </Button>

        {/* Vendor header */}
        <Card>
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{vendor.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Code: {vendor.code}
                  {vendor.email && <> · {vendor.email}</>}
                  {vendor.phone && <> · {vendor.phone}</>}
                </p>
              </div>
            </div>
            <Badge variant={vendor.status === 'approved' ? 'default' : 'secondary'} className="self-start md:self-auto capitalize">
              {vendor.status || 'unknown'}
            </Badge>
          </CardContent>
        </Card>

        {/* KPI summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Active Contracts</p>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{activeContracts}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{fmt(totalValue)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Amount Due</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{fmt(totalDue)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className={cn('text-2xl font-bold', overdueCount > 0 ? 'text-destructive' : 'text-foreground')}>{overdueCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Avg Progress</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{Math.round(avgProgress)}%</p>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contracts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contracts">
              <FileText className="h-4 w-4 mr-2" />
              Contracts ({contracts.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="h-4 w-4 mr-2" />
              Invoices ({invoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts">
            <Card>
              <CardContent className="p-0">
                {contracts.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">No contracts found for this vendor.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[200px]">Progress</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.po_number}</TableCell>
                          <TableCell className="text-muted-foreground">{c.order_date || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{c.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={c.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {c.qty_received} / {c.qty_ordered} ({Math.round(c.progress)}%)
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmt(c.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardContent className="p-0">
                {invoices.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">No invoices found for this vendor.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map(i => (
                        <TableRow key={i.id} className={i.is_overdue ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium">{i.invoice_number}</TableCell>
                          <TableCell className="text-muted-foreground">{i.invoice_date}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {i.due_date || '—'}
                            {i.is_overdue && <Badge variant="destructive" className="ml-2 text-xs">Overdue</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{i.payment_status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmt(i.total_amount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(i.paid_amount)}</TableCell>
                          <TableCell className={cn('text-right font-semibold', i.outstanding > 0 ? 'text-destructive' : 'text-foreground')}>
                            {fmt(i.outstanding)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

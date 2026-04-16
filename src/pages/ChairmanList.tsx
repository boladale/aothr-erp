import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Building2, FileText, Clock, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

type ListType = 'vendors' | 'contracts' | 'amount-due' | 'overdue' | 'progress';

interface VendorAgg {
  id: string;
  name: string;
  code: string;
  status: string | null;
  contracts: number;
  totalDue: number;
  overdueCount: number;
}

interface ContractRow {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
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
  vendor_id: string;
  vendor_name: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  payment_status: string;
  is_overdue: boolean;
  days_overdue: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const TYPE_META: Record<ListType, { title: string; description: string; icon: typeof Building2 }> = {
  vendors: { title: 'All Vendors', description: 'Read-only directory of every vendor', icon: Building2 },
  contracts: { title: 'Active Contracts', description: 'All open purchase orders across vendors', icon: FileText },
  'amount-due': { title: 'Amount Due', description: 'Outstanding invoices awaiting payment', icon: Clock },
  overdue: { title: 'Overdue Invoices', description: 'Invoices past their due date', icon: AlertCircle },
  progress: { title: 'Contract Progress', description: 'Fulfillment progress across active contracts', icon: BarChart3 },
};

export default function ChairmanList() {
  const { type } = useParams<{ type: ListType }>();
  const navigate = useNavigate();
  const { baseCurrency } = useOrgCurrency();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<VendorAgg[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const listType: ListType = (type as ListType) || 'vendors';
  const meta = TYPE_META[listType] || TYPE_META.vendors;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listType]);

  const load = async () => {
    setLoading(true);
    try {
      const today = todayISO();
      const [vRes, poRes, invRes] = await Promise.all([
        supabase.from('vendors').select('id, name, code, status'),
        supabase.from('purchase_orders').select('id, po_number, vendor_id, status, order_date, total_amount'),
        supabase.from('ap_invoices').select('id, invoice_number, vendor_id, invoice_date, due_date, total_amount, payment_status'),
      ]);

      const allVendors = vRes.data || [];
      const vendorById: Record<string, { name: string; code: string; status: string | null }> = {};
      allVendors.forEach((v: any) => { vendorById[v.id] = { name: v.name, code: v.code, status: v.status }; });

      // PO line aggregates for progress
      const allPos = poRes.data || [];
      const poIds = allPos.map((p: any) => p.id);
      const linesByPo: Record<string, { ord: number; rec: number }> = {};
      if (poIds.length) {
        const { data: lines } = await supabase
          .from('purchase_order_lines').select('po_id, quantity, qty_received').in('po_id', poIds);
        (lines || []).forEach((l: any) => {
          const t = linesByPo[l.po_id] || { ord: 0, rec: 0 };
          t.ord += Number(l.quantity || 0);
          t.rec += Number(l.qty_received || 0);
          linesByPo[l.po_id] = t;
        });
      }

      // Invoice payment allocations
      const allInvoices = invRes.data || [];
      const invIds = allInvoices.map((i: any) => i.id);
      const paidByInvoice: Record<string, number> = {};
      if (invIds.length) {
        const { data: allocs } = await supabase
          .from('ap_payment_allocations').select('invoice_id, allocated_amount').in('invoice_id', invIds);
        (allocs || []).forEach((a: any) => {
          paidByInvoice[a.invoice_id] = (paidByInvoice[a.invoice_id] || 0) + Number(a.allocated_amount || 0);
        });
      }

      const isActive = (s: string) => !['closed', 'cancelled', 'draft'].includes(s);
      const activePos = allPos.filter((p: any) => isActive(p.status));

      // Build contracts rows
      const contractRows: ContractRow[] = activePos.map((p: any) => {
        const t = linesByPo[p.id] || { ord: 0, rec: 0 };
        return {
          id: p.id,
          po_number: p.po_number,
          vendor_id: p.vendor_id,
          vendor_name: vendorById[p.vendor_id]?.name || '—',
          status: p.status,
          order_date: p.order_date,
          total_amount: Number(p.total_amount || 0),
          progress: t.ord > 0 ? Math.min(100, (t.rec / t.ord) * 100) : 0,
          qty_ordered: t.ord,
          qty_received: t.rec,
        };
      });
      setContracts(contractRows);

      // Build invoice rows
      const invoiceRows: InvoiceRow[] = allInvoices.map((i: any) => {
        const total = Number(i.total_amount || 0);
        const paid = paidByInvoice[i.id] || 0;
        const outstanding = Math.max(0, total - paid);
        const overdue = !!(i.due_date && i.due_date < today && outstanding > 0);
        const days = overdue ? Math.floor((Date.parse(today) - Date.parse(i.due_date)) / 86400000) : 0;
        return {
          id: i.id,
          invoice_number: i.invoice_number,
          vendor_id: i.vendor_id,
          vendor_name: vendorById[i.vendor_id]?.name || '—',
          invoice_date: i.invoice_date,
          due_date: i.due_date,
          total_amount: total,
          paid_amount: paid,
          outstanding,
          payment_status: i.payment_status,
          is_overdue: overdue,
          days_overdue: days,
        };
      });
      setInvoices(invoiceRows);

      // Build vendor aggregates
      const vAgg: Record<string, VendorAgg> = {};
      allVendors.forEach((v: any) => {
        vAgg[v.id] = { id: v.id, name: v.name, code: v.code, status: v.status, contracts: 0, totalDue: 0, overdueCount: 0 };
      });
      activePos.forEach((p: any) => { if (vAgg[p.vendor_id]) vAgg[p.vendor_id].contracts += 1; });
      invoiceRows.forEach(i => {
        if (!vAgg[i.vendor_id]) return;
        vAgg[i.vendor_id].totalDue += i.outstanding;
        if (i.is_overdue) vAgg[i.vendor_id].overdueCount += 1;
      });
      setVendors(Object.values(vAgg));
    } catch (e) {
      console.error('Chairman list error', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => formatCurrency(v, baseCurrency);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q));
  }, [vendors, search]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter(c => c.po_number.toLowerCase().includes(q) || c.vendor_name.toLowerCase().includes(q));
  }, [contracts, search]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = listType === 'overdue' ? invoices.filter(i => i.is_overdue) : invoices.filter(i => i.outstanding > 0);
    if (!q) return base;
    return base.filter(i => i.invoice_number.toLowerCase().includes(q) || i.vendor_name.toLowerCase().includes(q));
  }, [invoices, search, listType]);

  const sortedByProgress = useMemo(() => [...contracts].sort((a, b) => a.progress - b.progress), [contracts]);
  const filteredProgress = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedByProgress;
    return sortedByProgress.filter(c => c.po_number.toLowerCase().includes(q) || c.vendor_name.toLowerCase().includes(q));
  }, [sortedByProgress, search]);

  const renderBody = () => {
    if (loading) return <Skeleton className="h-96" />;

    if (listType === 'vendors') {
      return (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Active Contracts</TableHead>
              <TableHead className="text-right">Total Due</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No vendors found.</TableCell></TableRow>
              ) : filteredVendors.map(v => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chairman-dashboard/vendor/${v.id}`)}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.code}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{v.status || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{v.contracts}</TableCell>
                  <TableCell className={cn('text-right font-semibold', v.totalDue > 0 ? 'text-destructive' : 'text-foreground')}>{fmt(v.totalDue)}</TableCell>
                  <TableCell className="text-right">
                    {v.overdueCount > 0 ? <Badge variant="destructive">{v.overdueCount}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      );
    }

    if (listType === 'contracts') {
      return (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No active contracts.</TableCell></TableRow>
              ) : filteredContracts.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chairman-dashboard/vendor/${c.vendor_id}`)}>
                  <TableCell className="font-medium">{c.po_number}</TableCell>
                  <TableCell>{c.vendor_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.order_date || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={c.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">{c.qty_received} / {c.qty_ordered} ({Math.round(c.progress)}%)</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(c.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      );
    }

    if (listType === 'amount-due' || listType === 'overdue') {
      return (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No invoices.</TableCell></TableRow>
              ) : filteredInvoices.map(i => (
                <TableRow key={i.id} className={cn('cursor-pointer hover:bg-muted/50', i.is_overdue && 'bg-destructive/5')} onClick={() => navigate(`/chairman-dashboard/vendor/${i.vendor_id}`)}>
                  <TableCell className="font-medium">{i.invoice_number}</TableCell>
                  <TableCell>{i.vendor_name}</TableCell>
                  <TableCell className="text-muted-foreground">{i.invoice_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.due_date || '—'}
                    {i.is_overdue && <Badge variant="destructive" className="ml-2 text-xs">{i.days_overdue}d late</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(i.total_amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(i.paid_amount)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{fmt(i.outstanding)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      );
    }

    // progress
    return (
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>PO Number</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[260px]">Progress (lowest first)</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredProgress.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No active contracts.</TableCell></TableRow>
            ) : filteredProgress.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/chairman-dashboard/vendor/${c.vendor_id}`)}>
                <TableCell className="font-medium">{c.po_number}</TableCell>
                <TableCell>{c.vendor_name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Progress value={c.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{c.qty_received} / {c.qty_ordered} ({Math.round(c.progress)}%)</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(c.total_amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    );
  };

  const Icon = meta.icon;

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <Button variant="ghost" onClick={() => navigate('/chairman-dashboard')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Chairman Dashboard
        </Button>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{meta.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-muted/30"
          />
        </div>

        {renderBody()}
      </div>
    </AppLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown, Building2, FileText, DollarSign, AlertCircle, Clock, BarChart3, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrgCurrency } from '@/hooks/useOrgCurrency';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface VendorRow {
  id: string;
  name: string;
  code: string;
  contracts: number;
  totalValue: number;
  avgProgress: number;
  totalDue: number;
  overdueCount: number;
}

interface KPIDef {
  title: string;
  value: string;
  caption?: string;
  trend?: { value: number; positive: boolean; label: string };
  icon: typeof Building2;
  toneClass: string; // gradient bg
  iconClass: string;
  href: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ChairmanVendorDashboard() {
  const navigate = useNavigate();
  const { baseCurrency } = useOrgCurrency();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [kpis, setKpis] = useState({
    totalVendors: 0,
    activeContracts: 0,
    totalValue: 0,
    amountDue: 0,
    overdue: 0,
    avgProgress: 0,
    vendorsDeltaMonth: 0,
    contractsDeltaQuarter: 0,
    amountDueDeltaPctMonth: 0,
    overdueResolvedDelta: 0,
    progressDeltaPctMonth: 0,
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = todayISO();
      const startThisMonth = new Date();
      startThisMonth.setDate(1);
      const startPrevMonth = new Date(startThisMonth);
      startPrevMonth.setMonth(startPrevMonth.getMonth() - 1);
      const startThisQuarter = new Date();
      startThisQuarter.setMonth(Math.floor(startThisQuarter.getMonth() / 3) * 3, 1);

      const [vendorsRes, posRes, invoicesRes] = await Promise.all([
        supabase.from('vendors').select('id, name, code, status, created_at'),
        supabase.from('purchase_orders').select('id, vendor_id, total_amount, status, created_at'),
        supabase.from('ap_invoices').select('id, vendor_id, total_amount, due_date, payment_status, status, created_at'),
      ]);

      const allVendors = vendorsRes.data || [];
      const allPos = posRes.data || [];
      const allInvoices = invoicesRes.data || [];

      // Fetch PO line aggregates for "progress" (received vs ordered)
      const poIds = allPos.map(p => p.id);
      let progressByPo: Record<string, number> = {};
      if (poIds.length) {
        const { data: lines } = await supabase
          .from('purchase_order_lines')
          .select('po_id, quantity, qty_received')
          .in('po_id', poIds);
        const totals: Record<string, { ord: number; rec: number }> = {};
        (lines || []).forEach((l: any) => {
          const t = totals[l.po_id] || { ord: 0, rec: 0 };
          t.ord += Number(l.quantity || 0);
          t.rec += Number(l.qty_received || 0);
          totals[l.po_id] = t;
        });
        Object.entries(totals).forEach(([poId, t]) => {
          progressByPo[poId] = t.ord > 0 ? Math.min(100, (t.rec / t.ord) * 100) : 0;
        });
      }

      // Fetch payment allocations to compute outstanding per invoice
      const invIds = allInvoices.map(i => i.id);
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

      // Active contracts: POs not closed/cancelled
      const isActiveContract = (s: string) => !['closed', 'cancelled', 'draft'].includes(s);
      const activeContractsAll = allPos.filter(p => isActiveContract(p.status));

      // Aggregate per-vendor metrics
      const vendorMap: Record<string, VendorRow> = {};
      allVendors.forEach(v => {
        vendorMap[v.id] = {
          id: v.id,
          name: v.name,
          code: v.code,
          contracts: 0,
          totalValue: 0,
          avgProgress: 0,
          totalDue: 0,
          overdueCount: 0,
        };
      });

      const progressAcc: Record<string, { sum: number; n: number }> = {};
      activeContractsAll.forEach(po => {
        const row = vendorMap[po.vendor_id];
        if (!row) return;
        row.contracts += 1;
        row.totalValue += Number(po.total_amount || 0);
        const p = progressByPo[po.id] ?? 0;
        const acc = progressAcc[po.vendor_id] || { sum: 0, n: 0 };
        acc.sum += p;
        acc.n += 1;
        progressAcc[po.vendor_id] = acc;
      });
      Object.entries(progressAcc).forEach(([vid, a]) => {
        if (vendorMap[vid]) vendorMap[vid].avgProgress = a.n > 0 ? a.sum / a.n : 0;
      });

      let totalAmountDue = 0;
      let overdueCountAll = 0;
      allInvoices.forEach(inv => {
        if (inv.payment_status === 'paid') return;
        const total = Number(inv.total_amount || 0);
        const paid = paidByInvoice[inv.id] || 0;
        const outstanding = Math.max(0, total - paid);
        totalAmountDue += outstanding;
        const row = vendorMap[inv.vendor_id];
        if (row) row.totalDue += outstanding;
        if (inv.due_date && inv.due_date < today && outstanding > 0) {
          overdueCountAll += 1;
          if (row) row.overdueCount += 1;
        }
      });

      // KPI deltas
      const vendorsThisMonth = allVendors.filter(v => new Date(v.created_at) >= startThisMonth).length;
      const contractsThisQuarter = allPos.filter(p => new Date(p.created_at) >= startThisQuarter && isActiveContract(p.status)).length;

      // Avg progress across all active contracts
      const allProgressVals = activeContractsAll.map(p => progressByPo[p.id] ?? 0);
      const avgProgressAll = allProgressVals.length
        ? allProgressVals.reduce((a, b) => a + b, 0) / allProgressVals.length
        : 0;

      setVendors(Object.values(vendorMap).filter(v => v.contracts > 0 || v.totalDue > 0));
      setKpis({
        totalVendors: allVendors.length,
        activeContracts: activeContractsAll.length,
        totalValue: activeContractsAll.reduce((s, p) => s + Number(p.total_amount || 0), 0),
        amountDue: totalAmountDue,
        overdue: overdueCountAll,
        avgProgress: avgProgressAll,
        vendorsDeltaMonth: vendorsThisMonth,
        contractsDeltaQuarter: contractsThisQuarter,
        amountDueDeltaPctMonth: 0,
        overdueResolvedDelta: 0,
        progressDeltaPctMonth: 0,
      });
    } catch (e) {
      console.error('Chairman dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q));
  }, [vendors, search]);

  const fmt = (v: number) => formatCurrency(v, baseCurrency);
  const fmtCompact = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };
  const symbol = getCurrencySymbol(baseCurrency);

  const kpiDefs: KPIDef[] = [
    {
      title: 'Total Vendors',
      value: String(kpis.totalVendors),
      icon: Building2,
      toneClass: 'from-blue-50 to-blue-100/60 border-blue-200/60 dark:from-blue-950/40 dark:to-blue-900/20 dark:border-blue-800/40',
      iconClass: 'text-blue-600 dark:text-blue-400',
      trend: kpis.vendorsDeltaMonth > 0 ? { value: kpis.vendorsDeltaMonth, positive: true, label: 'this month' } : undefined,
      href: '/vendors',
    },
    {
      title: 'Active Contracts',
      value: String(kpis.activeContracts),
      icon: FileText,
      toneClass: 'from-emerald-50 to-emerald-100/60 border-emerald-200/60 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:border-emerald-800/40',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      trend: kpis.contractsDeltaQuarter > 0 ? { value: kpis.contractsDeltaQuarter, positive: true, label: 'this quarter' } : undefined,
      href: '/purchase-orders',
    },
    {
      title: 'Total Value',
      value: `${symbol}${fmtCompact(kpis.totalValue)}`,
      caption: 'Contract Portfolio',
      icon: DollarSign,
      toneClass: 'from-purple-50 to-purple-100/60 border-purple-200/60 dark:from-purple-950/40 dark:to-purple-900/20 dark:border-purple-800/40',
      iconClass: 'text-purple-600 dark:text-purple-400',
      href: '/purchase-orders',
    },
    {
      title: 'Amount Due',
      value: `${symbol}${fmtCompact(kpis.amountDue)}`,
      icon: Clock,
      toneClass: 'from-amber-50 to-amber-100/60 border-amber-200/60 dark:from-amber-950/40 dark:to-amber-900/20 dark:border-amber-800/40',
      iconClass: 'text-amber-600 dark:text-amber-400',
      href: '/ap-aging',
    },
    {
      title: 'Overdue',
      value: String(kpis.overdue),
      caption: 'Invoices',
      icon: AlertCircle,
      toneClass: 'from-rose-50 to-rose-100/60 border-rose-200/60 dark:from-rose-950/40 dark:to-rose-900/20 dark:border-rose-800/40',
      iconClass: 'text-rose-600 dark:text-rose-400',
      href: '/ap-aging',
    },
    {
      title: 'Avg Progress',
      value: `${Math.round(kpis.avgProgress)}%`,
      icon: BarChart3,
      toneClass: 'from-teal-50 to-teal-100/60 border-teal-200/60 dark:from-teal-950/40 dark:to-teal-900/20 dark:border-teal-800/40',
      iconClass: 'text-teal-600 dark:text-teal-400',
      href: '/po-closure-report',
    },
  ];

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        {/* Hero header */}
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Chairman Dashboard</h1>
              <p className="text-muted-foreground mt-1">Vendor &amp; Contract Management Overview</p>
            </div>
            <Badge variant="outline" className="self-start md:self-auto px-3 py-1.5 text-xs font-medium">
              {new Date().toLocaleDateString()} · Live Data
            </Badge>
          </CardContent>
        </Card>

        {/* KPI cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiDefs.map((k) => (
              <Card
                key={k.title}
                onClick={() => navigate(k.href)}
                className={cn(
                  'border bg-gradient-to-br cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  k.toneClass
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(k.href); } }}
              >
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium text-muted-foreground leading-tight">{k.title}</p>
                    <k.icon className={cn('h-4 w-4 shrink-0', k.iconClass)} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <div className="mt-auto">
                    {k.trend ? (
                      <div className={cn('flex items-center gap-1 text-xs font-medium',
                        k.trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {k.trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>+{k.trend.value} {k.trend.label}</span>
                      </div>
                    ) : k.caption ? (
                      <p className="text-xs text-muted-foreground">{k.caption}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Vendor Management</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 bg-muted/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vendor cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              No vendors with active contracts or outstanding balances.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => (
              <Card key={v.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground leading-tight">{v.name}</h3>
                    {v.overdueCount > 0 && (
                      <Badge variant="destructive" className="rounded-full text-xs px-2.5 py-0.5 shrink-0">
                        {v.overdueCount} Overdue
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Contracts</p>
                      <p className="text-lg font-semibold text-foreground">{v.contracts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="text-lg font-semibold text-foreground">{fmt(v.totalValue)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Average Progress</span>
                      <span className="font-medium text-foreground">{Math.round(v.avgProgress)}%</span>
                    </div>
                    <Progress value={v.avgProgress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">Total Due</span>
                    <span className={cn('text-sm font-bold', v.totalDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                      {fmt(v.totalDue)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Real-time Vendor &amp; Contract Monitoring
        </p>
      </div>
    </AppLayout>
  );
}

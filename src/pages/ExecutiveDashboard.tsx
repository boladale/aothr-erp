import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/currency';
import { ArrowRight, Sparkle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type PeriodKey = 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
};

function periodRange(key: PeriodKey) {
  const now = new Date();
  const end = now;
  let start: Date;
  if (key === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === 'quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  else start = new Date(now.getFullYear(), 0, 1);
  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span);
  return { start, end, prevStart, prevEnd: start };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function compactAmount(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `₦${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return formatCurrency(n);
}

function scoreLabel(score: number) {
  if (score >= 90) return { label: 'Excellent', tone: 'text-success' };
  if (score >= 80) return { label: 'Good', tone: 'text-success' };
  if (score >= 65) return { label: 'Healthy', tone: 'text-success' };
  if (score >= 50) return { label: 'Fair', tone: 'text-warning' };
  return { label: 'Needs attention', tone: 'text-destructive' };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

type Driver = { label: string; weight: string; value: string; detail: string };
type Department = { name: string; score: number; path: string; drivers: Driver[] };

function ScoreCard({ title, value, suffix, sub, subTone }: { title: string; value: string; suffix?: string; sub?: string; subTone?: string }) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-1">
        <p className="text-sm text-muted-foreground leading-tight">{title}</p>
        <p className="text-3xl font-bold tracking-tight">
          {value}
          {suffix && <span className="text-base font-medium text-muted-foreground">{suffix}</span>}
        </p>
        {sub && <p className={`text-sm font-medium ${subTone || 'text-muted-foreground'}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const range = useMemo(() => periodRange(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ['executive-intelligence', period],
    queryFn: async () => {
      const monthsBack = 6;
      const chartStart = new Date();
      chartStart.setMonth(chartStart.getMonth() - monthsBack);
      chartStart.setDate(1);

      const [ar, arPrev, arSeries, ap, banks, pos, grns, items, projects, employees, leaves, budgets] = await Promise.all([
        supabase.from('ar_invoices').select('total_amount, payment_status, invoice_date').gte('invoice_date', iso(range.start)).lte('invoice_date', iso(range.end)),
        supabase.from('ar_invoices').select('total_amount').gte('invoice_date', iso(range.prevStart)).lt('invoice_date', iso(range.prevEnd)),
        supabase.from('ar_invoices').select('total_amount, invoice_date').gte('invoice_date', iso(chartStart)),
        supabase.from('ap_invoices').select('total_amount, payment_status, due_date'),
        supabase.from('bank_accounts').select('current_balance, is_active').eq('is_active', true),
        supabase.from('purchase_orders').select('id, status, total_amount, created_at, expected_date'),
        supabase.from('goods_receipts').select('id, status, receipt_date, purchase_order_id'),
        supabase.from('inventory_balances').select('quantity, item:items(reorder_level, unit_cost)'),
        supabase.from('projects').select('id, status, budget_amount'),
        supabase.from('employees').select('id, status'),
        supabase.from('leave_requests').select('id, status'),
        supabase.from('budget_lines').select('annual_amount, committed_amount, actual_amount'),
      ]);

      const sum = (rows: any[] | null, f: (r: any) => number) => (rows || []).reduce((s, r) => s + (Number(f(r)) || 0), 0);

      const revenue = sum(ar.data, (r) => r.total_amount);
      const prevRevenue = sum(arPrev.data, (r) => r.total_amount);
      const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

      const cash = sum(banks.data, (r) => r.current_balance);
      const apOutstanding = sum((ap.data || []).filter((i: any) => i.payment_status !== 'paid'), (r) => r.total_amount);
      const arOutstanding = sum((ar.data || []).filter((i: any) => i.payment_status !== 'paid'), (r) => r.total_amount);
      const overdueAP = (ap.data || []).filter((i: any) => i.payment_status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()).length;
      const openAP = (ap.data || []).filter((i: any) => i.payment_status !== 'paid').length;

      // Revenue series (last 7 months)
      const series: { month: string; amount: number }[] = [];
      for (let i = monthsBack; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('en', { month: 'short' });
        const amount = sum((arSeries.data || []).filter((r: any) => {
          const dt = new Date(r.invoice_date);
          return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
        }), (r) => r.total_amount);
        series.push({ month: key, amount });
      }

      // Procurement health: completion rate + on-time delivery
      const allPos = pos.data || [];
      const closedPos = allPos.filter((p: any) => ['closed', 'completed', 'received'].includes(String(p.status)));
      const receivedPoIds = new Set((grns.data || []).map((g: any) => g.purchase_order_id));
      const sentPos = allPos.filter((p: any) => !['draft', 'cancelled', 'rejected'].includes(String(p.status)));
      const fulfilled = sentPos.filter((p: any) => receivedPoIds.has(p.id)).length;
      const onTime = (grns.data || []).filter((g: any) => {
        const po = allPos.find((p: any) => p.id === g.purchase_order_id);
        return po?.expected_date ? new Date(g.receipt_date) <= new Date(po.expected_date) : true;
      }).length;
      const grnCount = (grns.data || []).length;
      const fulfilmentRate = sentPos.length ? (fulfilled / sentPos.length) * 100 : 100;
      const onTimeRate = grnCount ? (onTime / grnCount) * 100 : 100;
      const procurementHealth = clamp(fulfilmentRate * 0.5 + onTimeRate * 0.5);

      // Inventory health: % of items above reorder level
      const invRows = items.data || [];
      const belowReorder = invRows.filter((r: any) => Number(r.quantity || 0) < Number(r.item?.reorder_level || 0)).length;
      const inventoryHealth = invRows.length ? clamp(100 - (belowReorder / invRows.length) * 100) : 100;

      // Finance health: liquidity + AP overdue discipline
      const liquidity = apOutstanding > 0 ? Math.min(cash / apOutstanding, 1.5) / 1.5 * 100 : 100;
      const apDiscipline = openAP ? 100 - (overdueAP / openAP) * 100 : 100;
      const financeHealth = clamp(liquidity * 0.6 + apDiscipline * 0.4);

      // HR health: active employee ratio + pending leave backlog
      const emp = employees.data || [];
      const activeEmp = emp.filter((e: any) => String(e.status) === 'active').length;
      const pendingLeave = (leaves.data || []).filter((l: any) => String(l.status) === 'pending').length;
      const totalLeave = (leaves.data || []).length;
      const hrHealth = clamp((emp.length ? (activeEmp / emp.length) * 100 : 100) * 0.7 + (totalLeave ? (100 - (pendingLeave / totalLeave) * 100) : 100) * 0.3);

      // Projects health: active vs on-hold/cancelled
      const projRows = projects.data || [];
      const healthyProjects = projRows.filter((p: any) => ['active', 'in_progress', 'completed'].includes(String(p.status))).length;
      const projectsHealth = projRows.length ? clamp((healthyProjects / projRows.length) * 100) : 100;

      // Budget health
      const budgetTotal = sum(budgets.data, (r) => r.annual_amount);
      const budgetUsed = sum(budgets.data, (r) => Number(r.committed_amount || 0) + Number(r.actual_amount || 0));
      const budgetUtil = budgetTotal ? (budgetUsed / budgetTotal) * 100 : 0;
      const budgetHealth = budgetTotal ? clamp(100 - Math.max(0, budgetUtil - 90) * 3) : 100;

      const pct = (n: number) => `${Math.round(n)}%`;

      const departments: Department[] = [
        {
          name: 'Finance',
          score: financeHealth,
          path: '/finance-dashboard',
          drivers: [
            {
              label: 'Liquidity (cash vs unpaid supplier invoices)',
              weight: '60%',
              value: pct(liquidity),
              detail: apOutstanding > 0
                ? `${compactAmount(cash)} cash against ${compactAmount(apOutstanding)} owed. Full marks at 1.5x cover.`
                : 'No unpaid supplier invoices, so liquidity scores full marks.',
            },
            {
              label: 'Payment discipline (invoices not past due)',
              weight: '40%',
              value: pct(apDiscipline),
              detail: openAP ? `${overdueAP} of ${openAP} open supplier invoices are past their due date.` : 'No open supplier invoices.',
            },
          ],
        },
        {
          name: 'Procurement',
          score: procurementHealth,
          path: '/procurement-dashboard',
          drivers: [
            {
              label: 'Order fulfilment (POs with goods received)',
              weight: '50%',
              value: pct(fulfilmentRate),
              detail: sentPos.length
                ? `${fulfilled} of ${sentPos.length} live purchase orders have at least one posted goods receipt.`
                : 'No live purchase orders in this period.',
            },
            {
              label: 'On-time delivery (receipts on/before expected date)',
              weight: '50%',
              value: pct(onTimeRate),
              detail: grnCount
                ? `${onTime} of ${grnCount} goods receipts arrived on or before the expected date.`
                : 'No goods receipts posted yet.',
            },
          ],
        },
        {
          name: 'HR',
          score: hrHealth,
          path: '/employees',
          drivers: [
            {
              label: 'Active staff ratio',
              weight: '70%',
              value: pct(emp.length ? (activeEmp / emp.length) * 100 : 100),
              detail: emp.length ? `${activeEmp} of ${emp.length} employees are active.` : 'No employees recorded.',
            },
            {
              label: 'Leave backlog cleared',
              weight: '30%',
              value: pct(totalLeave ? 100 - (pendingLeave / totalLeave) * 100 : 100),
              detail: totalLeave ? `${pendingLeave} of ${totalLeave} leave requests are still pending approval.` : 'No leave requests recorded.',
            },
          ],
        },
        {
          name: 'Inventory',
          score: inventoryHealth,
          path: '/inventory',
          drivers: [
            {
              label: 'Stock above reorder level',
              weight: '100%',
              value: pct(inventoryHealth),
              detail: invRows.length ? `${belowReorder} of ${invRows.length} stock records are below their reorder level.` : 'No stock records found.',
            },
          ],
        },
        {
          name: 'Projects',
          score: projectsHealth,
          path: '/projects',
          drivers: [
            {
              label: 'Projects active or completed (not on hold/cancelled)',
              weight: '100%',
              value: pct(projectsHealth),
              detail: projRows.length ? `${healthyProjects} of ${projRows.length} projects are active, in progress or completed.` : 'No projects recorded.',
            },
          ],
        },
        {
          name: 'Budgets',
          score: budgetHealth,
          path: '/budgets',
          drivers: [
            {
              label: 'Budget utilisation headroom',
              weight: '100%',
              value: pct(budgetHealth),
              detail: budgetTotal
                ? `${budgetUtil.toFixed(0)}% of budget committed or spent. Score only drops once utilisation passes 90%.`
                : 'No budgets set, so this scores full marks by default.',
            },
          ],
        },
      ];

      const businessHealth = clamp(departments.reduce((s, d) => s + d.score, 0) / departments.length);

      const insights: string[] = [];
      if (revenueDelta > 0) insights.push(`Revenue is up ${revenueDelta.toFixed(1)}% versus the previous period.`);
      else if (revenueDelta < 0) insights.push(`Revenue is down ${Math.abs(revenueDelta).toFixed(1)}% versus the previous period.`);
      if (overdueAP > 0) insights.push(`${overdueAP} supplier invoice${overdueAP > 1 ? 's are' : ' is'} past due — settle to protect vendor relationships.`);
      if (belowReorder > 0) insights.push(`${belowReorder} item${belowReorder > 1 ? 's are' : ' is'} below reorder level.`);
      if (onTimeRate < 80 && grnCount > 0) insights.push(`On-time delivery is ${onTimeRate.toFixed(0)}% — review supplier lead times.`);
      if (budgetUtil > 90) insights.push(`Budget utilisation is ${budgetUtil.toFixed(0)}% — approvals may soon exceed budget.`);
      if (arOutstanding > 0) insights.push(`${compactAmount(arOutstanding)} in customer invoices is still unpaid.`);
      if (!insights.length) insights.push('All monitored areas are operating within normal ranges.');

      return {
        revenue, revenueDelta, cash, arOutstanding, apOutstanding,
        businessHealth, procurementHealth, departments, series,
        insights: insights.slice(0, 3),
      };
    },
  });

  if (isLoading || !data) {
    return (
      <AppLayout>
        <div className="page-container space-y-6">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </div>
      </AppLayout>
    );
  }

  const bh = scoreLabel(data.businessHealth);
  const ph = scoreLabel(data.procurementHealth);
  const maxSeries = Math.max(...data.series.map((s) => s.amount), 1);

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executive Intelligence</h1>
            <p className="text-muted-foreground">Real-time overview of enterprise performance</p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
                <SelectItem key={k} value={k}>{PERIOD_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <ScoreCard title="Business Health Score" value={String(data.businessHealth)} suffix="/100" sub={`● ${bh.label}`} subTone={bh.tone} />
          <ScoreCard
            title="Revenue"
            value={compactAmount(data.revenue)}
            sub={`${data.revenueDelta >= 0 ? '+' : ''}${data.revenueDelta.toFixed(1)}%`}
            subTone={data.revenueDelta >= 0 ? 'text-success' : 'text-destructive'}
          />
          <ScoreCard title="Cash Position" value={compactAmount(data.cash)} sub={`${compactAmount(data.arOutstanding)} receivable`} />
          <ScoreCard title="Procurement Health" value={String(data.procurementHealth)} suffix="/100" sub={`● ${ph.label}`} subTone={ph.tone} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Revenue Performance <span className="text-muted-foreground font-normal">Last 7 months</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight mb-2">{compactAmount(data.revenue)}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.series}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {data.series.map((s, i) => (
                      <Cell key={i} fill={s.amount >= maxSeries ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.55)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkle className="h-4 w-4 text-primary" /> Business Insight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {data.insights.map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary">•</span>{t}
                  </li>
                ))}
              </ul>
              <Button variant="link" className="px-0" onClick={() => navigate('/financial-reports')}>
                View intelligence <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-sm text-muted-foreground mb-3">Department Health Scores — click the info icon to see why</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {data.departments.map((d) => {
              const s = scoreLabel(d.score);
              return (
                <Card key={d.name} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(d.path)}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium">{d.name}</p>
                      <button
                        type="button"
                        aria-label={`Why is ${d.name} scored ${d.score}?`}
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); setExplain(d); }}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-2xl font-bold">{d.score}</p>
                    <p className={`text-xs ${s.tone} flex items-center gap-1`}>
                      {d.score >= 65 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {s.label}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Dialog open={!!explain} onOpenChange={(o) => !o && setExplain(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{explain?.name} Health — {explain?.score}/100</DialogTitle>
              <DialogDescription>
                This score is a weighted average of the KPIs below. 100 means every KPI is fully met; the score drops only where a KPI falls short.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {explain?.drivers.map((dr) => (
                <div key={dr.label} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{dr.label}</p>
                    <span className="text-sm font-semibold">{dr.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Weight in score: {dr.weight}</p>
                  <p className="text-xs text-muted-foreground">{dr.detail}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Departments showing 100 do so because they have no shortfalls recorded — often because there is no data yet in that area
                (for example no budgets set or no open supplier invoices), which the score treats as "nothing at risk".
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { ArrowRight, Sparkle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

type Metric = { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral'; path?: string };
type Section = { title: string; key: string; metrics: Metric[]; raw: Record<string, number | string> };

const sb = supabase as any;
const num = (v: any) => Number(v) || 0;
const sum = (rows: any[] | null | undefined, f: (r: any) => any) => (rows || []).reduce((s, r) => s + num(f(r)), 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `₦${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `₦${(n / 1e3).toFixed(0)}K`;
  return formatCurrency(n);
}
const pctChange = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null);

async function executiveSection(): Promise<Section> {
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const prevStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const { data: lines } = await sb
    .from('gl_journal_lines')
    .select('debit, credit, gl_accounts!inner(account_type, account_code, account_name), gl_journal_entries!inner(status, entry_date)')
    .eq('gl_journal_entries.status', 'posted')
    .gte('gl_journal_entries.entry_date', iso(prevStart));
  const bucket = (from: Date, to: Date) => {
    let revenue = 0, cos = 0, expense = 0;
    (lines || []).forEach((l: any) => {
      const d = new Date(l.gl_journal_entries.entry_date);
      if (d < from || d > to) return;
      const t = l.gl_accounts.account_type;
      const code = String(l.gl_accounts.account_code || '');
      const name = String(l.gl_accounts.account_name || '').toLowerCase();
      if (t === 'revenue') revenue += num(l.credit) - num(l.debit);
      else if (t === 'expense') {
        const amt = num(l.debit) - num(l.credit);
        if (code.startsWith('51') || name.includes('cost of')) cos += amt; else expense += amt;
      }
    });
    return { revenue, cos, expense, profit: revenue - cos - expense };
  };
  const cur = bucket(ytdStart, now);
  const prev = bucket(prevStart, prevEnd);
  const ch = pctChange(cur.profit, prev.profit);
  const margin = cur.revenue ? (cur.profit / cur.revenue) * 100 : 0;
  return {
    title: 'Company performance — year to date', key: 'executive',
    metrics: [
      { label: 'YTD Revenue', value: compact(cur.revenue), sub: `Last year same time: ${compact(prev.revenue)}`, path: '/financial-reports' },
      { label: 'YTD Cost of Sales', value: compact(cur.cos), sub: `Last year: ${compact(prev.cos)}`, path: '/financial-reports' },
      { label: 'YTD Expenses', value: compact(cur.expense), sub: `Last year: ${compact(prev.expense)}`, path: '/financial-reports' },
      { label: 'YTD Profit', value: compact(cur.profit), sub: `Margin ${margin.toFixed(1)}%`, tone: cur.profit >= 0 ? 'good' : 'bad', path: '/financial-reports' },
      { label: 'Profit vs last year YTD', value: ch === null ? '—' : `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`, sub: `Last year YTD profit: ${compact(prev.profit)}`, tone: ch === null ? 'neutral' : ch >= 0 ? 'good' : 'bad' },
    ],
    raw: { ytd_revenue: cur.revenue, ytd_cost_of_sales: cur.cos, ytd_expenses: cur.expense, ytd_profit: cur.profit, last_year_ytd_profit: prev.profit, last_year_ytd_revenue: prev.revenue, profit_change_pct: ch ?? 'n/a' },
  };
}

async function procurementSection(): Promise<Section> {
  const [{ data: pos }, { data: reqs }, { data: rfqs }] = await Promise.all([
    sb.from('purchase_orders').select('status, total_amount'),
    sb.from('requisitions').select('status'),
    sb.from('rfps').select('status'),
  ]);
  const P = pos || [];
  const approvedSet = ['approved', 'sent', 'partially_received', 'fully_received', 'closed'];
  const approved = P.filter((p: any) => approvedSet.includes(p.status));
  const pending = P.filter((p: any) => p.status === 'pending_approval');
  const drafts = P.filter((p: any) => p.status === 'draft');
  const awaitingDelivery = P.filter((p: any) => ['sent', 'partially_received'].includes(p.status));
  const pendingReqs = (reqs || []).filter((r: any) => r.status === 'pending_approval').length;
  const approvedReqs = (reqs || []).filter((r: any) => r.status === 'approved').length;
  const openRfq = (rfqs || []).filter((r: any) => ['published', 'evaluating'].includes(r.status)).length;
  return {
    title: 'Procurement', key: 'procurement',
    metrics: [
      { label: 'Approved POs', value: String(approved.length), sub: compact(sum(approved, (p) => p.total_amount)), tone: 'good', path: '/purchase-orders' },
      { label: 'POs awaiting approval', value: String(pending.length), sub: compact(sum(pending, (p) => p.total_amount)), tone: pending.length ? 'bad' : 'neutral', path: '/purchase-orders' },
      { label: 'Draft POs (not submitted)', value: String(drafts.length), sub: compact(sum(drafts, (p) => p.total_amount)), path: '/purchase-orders' },
      { label: 'POs awaiting delivery', value: String(awaitingDelivery.length), sub: compact(sum(awaitingDelivery, (p) => p.total_amount)), path: '/goods-delivered' },
      { label: 'Requisitions to approve', value: String(pendingReqs), sub: `${approvedReqs} approved, not yet ordered`, tone: pendingReqs ? 'bad' : 'neutral', path: '/requisitions' },
      { label: 'Open RFQs', value: String(openRfq), path: '/rfps' },
    ],
    raw: { approved_pos: approved.length, approved_po_value: sum(approved, (p) => p.total_amount), pos_pending_approval: pending.length, pending_value: sum(pending, (p) => p.total_amount), draft_pos: drafts.length, pos_awaiting_delivery: awaitingDelivery.length, requisitions_pending_approval: pendingReqs, approved_requisitions_not_ordered: approvedReqs, open_rfqs: openRfq },
  };
}

async function financeSection(): Promise<Section> {
  const [{ data: banks }, { data: ar }, { data: ap }] = await Promise.all([
    sb.from('bank_accounts').select('current_balance').eq('is_active', true),
    sb.from('ar_invoices').select('total_amount, payment_status, due_date'),
    sb.from('ap_invoices').select('total_amount, payment_status, due_date'),
  ]);
  const today = new Date();
  const open = (rows: any[]) => (rows || []).filter((i) => i.payment_status !== 'paid');
  const bal = (i: any) => num(i.total_amount) - num(i.amount_paid);
  const arOpen = open(ar), apOpen = open(ap);
  const arOver = arOpen.filter((i) => i.due_date && new Date(i.due_date) < today);
  const apOver = apOpen.filter((i) => i.due_date && new Date(i.due_date) < today);
  const cash = sum(banks, (b) => b.current_balance);
  return {
    title: 'Finance & cash', key: 'finance',
    metrics: [
      { label: 'Cash in bank', value: compact(cash), path: '/bank-accounts' },
      { label: 'Owed by customers', value: compact(sum(arOpen, bal)), sub: `${arOpen.length} open invoices`, path: '/ar-aging' },
      { label: 'Overdue from customers', value: compact(sum(arOver, bal)), sub: `${arOver.length} invoices past due`, tone: arOver.length ? 'bad' : 'good', path: '/ar-aging' },
      { label: 'Owed to suppliers', value: compact(sum(apOpen, bal)), sub: `${apOpen.length} open invoices`, path: '/ap-aging' },
      { label: 'Overdue to suppliers', value: compact(sum(apOver, bal)), sub: `${apOver.length} invoices past due`, tone: apOver.length ? 'bad' : 'good', path: '/ap-aging' },
    ],
    raw: { cash, receivables: sum(arOpen, bal), overdue_receivables: sum(arOver, bal), payables: sum(apOpen, bal), overdue_payables: sum(apOver, bal) },
  };
}

async function warehouseSection(): Promise<Section> {
  const [{ data: inv }, { data: grns }, { data: issues }] = await Promise.all([
    sb.from('inventory_balances').select('quantity, item:items(reorder_level, unit_cost)'),
    sb.from('goods_receipts').select('status'),
    sb.from('inventory_issues').select('status'),
  ]);
  const rows = inv || [];
  const low = rows.filter((r: any) => num(r.item?.reorder_level) > 0 && num(r.quantity) < num(r.item?.reorder_level)).length;
  const value = sum(rows, (r) => num(r.quantity) * num(r.item?.unit_cost));
  const draftGrn = (grns || []).filter((g: any) => g.status === 'draft').length;
  const draftIss = (issues || []).filter((g: any) => ['draft', 'pending_approval'].includes(g.status)).length;
  return {
    title: 'Warehouse & stock', key: 'warehouse',
    metrics: [
      { label: 'Stock value', value: compact(value), path: '/inventory-valuation' },
      { label: 'Items below reorder level', value: String(low), tone: low ? 'bad' : 'good', path: '/inventory' },
      { label: 'Goods receipts not posted', value: String(draftGrn), path: '/goods-receipts' },
      { label: 'Issues awaiting action', value: String(draftIss), path: '/inventory-issues' },
    ],
    raw: { stock_value: value, items_below_reorder: low, unposted_grns: draftGrn, pending_issues: draftIss },
  };
}

async function hrSection(): Promise<Section> {
  const [{ data: emp }, { data: leave }, { data: exp }] = await Promise.all([
    sb.from('employees').select('status'),
    sb.from('leave_requests').select('status'),
    sb.from('expense_claims').select('status, total_amount'),
  ]);
  const active = (emp || []).filter((e: any) => e.status === 'active').length;
  const pendingLeave = (leave || []).filter((l: any) => l.status === 'pending').length;
  const pendingExp = (exp || []).filter((e: any) => e.status === 'submitted');
  return {
    title: 'People (HR)', key: 'hr',
    metrics: [
      { label: 'Active staff', value: String(active), sub: `${(emp || []).length} total`, path: '/employees' },
      { label: 'Leave requests to approve', value: String(pendingLeave), tone: pendingLeave ? 'bad' : 'good', path: '/leave-management' },
      { label: 'Expense claims to review', value: String(pendingExp.length), sub: compact(sum(pendingExp, (e) => e.total_amount)) },
    ],
    raw: { active_staff: active, pending_leave: pendingLeave, pending_expense_claims: pendingExp.length },
  };
}

async function staffSection(userId: string): Promise<Section | null> {
  const { data: employee } = await sb.from('employees').select('id').eq('user_id', userId).maybeSingle();
  const { data: reqs } = await sb.from('requisitions').select('status').eq('created_by', userId);
  const myReqs = reqs || [];
  const metrics: Metric[] = [
    { label: 'My requisitions awaiting approval', value: String(myReqs.filter((r: any) => r.status === 'pending_approval').length), path: '/requisitions' },
    { label: 'My approved requisitions', value: String(myReqs.filter((r: any) => r.status === 'approved').length), path: '/requisitions' },
  ];
  const raw: Record<string, number> = { my_pending_requisitions: num(metrics[0].value), my_approved_requisitions: num(metrics[1].value) };
  if (employee) {
    const [{ data: lb }, { count }] = await Promise.all([
      sb.from('leave_balances').select('remaining_days').eq('employee_id', employee.id).eq('year', new Date().getFullYear()),
      sb.from('leave_requests').select('*', { count: 'exact', head: true }).eq('employee_id', employee.id).eq('status', 'pending'),
    ]);
    const days = sum(lb, (b) => b.remaining_days);
    metrics.push({ label: 'My leave days left', value: String(days), path: '/self-service/leave' });
    metrics.push({ label: 'My leave requests pending', value: String(count || 0), path: '/self-service/leave' });
    raw.leave_days_left = days; raw.pending_leave = count || 0;
  }
  return { title: 'My work', key: 'staff', metrics, raw };
}

export default function MyBriefing() {
  const { user, profile, hasRole, roles } = useAuth();
  const navigate = useNavigate();

  const isExec = hasRole('executive' as any) || hasRole('admin');
  const isProc = hasRole('procurement_manager') || hasRole('procurement_officer');
  const isFin = hasRole('finance_manager') || hasRole('accounts_payable') || hasRole('ap_clerk');
  const isWh = hasRole('warehouse_manager') || hasRole('warehouse_officer');
  const isHr = hasRole('hr_manager') || hasRole('hr_officer') || hasRole('payroll_manager');

  const roleLabel = [isExec && 'Chairman / MD', isProc && 'Procurement', isFin && 'Finance', isWh && 'Warehouse', isHr && 'HR'].filter(Boolean).join(', ') || 'Staff';

  const { data: sections, isLoading } = useQuery({
    queryKey: ['my-briefing', user?.id, roles.join(',')],
    enabled: !!user,
    queryFn: async () => {
      const jobs: Promise<Section | null>[] = [];
      if (isExec) jobs.push(executiveSection());
      if (isExec || isFin) jobs.push(financeSection());
      if (isExec || isProc) jobs.push(procurementSection());
      if (isWh) jobs.push(warehouseSection());
      if (isHr) jobs.push(hrSection());
      if (!isExec && !isProc && !isFin && !isWh && !isHr) jobs.push(staffSection(user!.id));
      const res = await Promise.allSettled(jobs);
      return res.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
    },
  });

  const { data: ai, isFetching: aiLoading, refetch: refetchAi, error: aiError } = useQuery({
    queryKey: ['my-briefing-ai', user?.id, sections?.map((s) => JSON.stringify(s.raw)).join('|')],
    enabled: !!sections && sections.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const metrics = Object.fromEntries(sections!.map((s) => [s.key, s.raw]));
      const { data, error } = await supabase.functions.invoke('briefing-summary', {
        body: { roleLabel, name: profile?.full_name, metrics },
      });
      if (error) {
        let msg = 'The AI summary could not be generated.';
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data.summary as string;
    },
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppLayout>
      <div className="page-container space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 className="text-3xl font-bold tracking-tight">{greeting}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
            <p className="text-muted-foreground">Your briefing · {roleLabel}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Go to full dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Sparkle className="h-4 w-4 text-primary" /> AI summary</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchAi()} disabled={aiLoading || !sections?.length}>
              <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading || aiLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
            ) : aiError ? (
              <p className="text-sm text-destructive">{(aiError as Error).message}</p>
            ) : (
              <p className="text-sm leading-relaxed">{ai || 'No data yet to summarise.'}</p>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          sections?.map((s) => (
            <section key={s.key} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</h2>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {s.metrics.map((m) => (
                  <Card key={m.label} className={m.path ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''} onClick={() => m.path && navigate(m.path)}>
                    <CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
                      <p className={`text-2xl font-bold tracking-tight flex items-center gap-1 ${m.tone === 'good' ? 'text-success' : m.tone === 'bad' ? 'text-destructive' : ''}`}>
                        {m.tone === 'good' && <TrendingUp className="h-4 w-4" />}
                        {m.tone === 'bad' && <TrendingDown className="h-4 w-4" />}
                        {m.value}
                      </p>
                      {m.sub && <p className="text-xs text-muted-foreground">{m.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppLayout>
  );
}

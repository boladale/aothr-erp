import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, Play, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

type Status = 'pass' | 'warn' | 'fail' | 'pending';

interface Check {
  id: string;
  category: string;
  name: string;
  status: Status;
  message: string;
  fix?: string;
}

const initialChecks: Omit<Check, 'status' | 'message'>[] = [
  { id: 'db',           category: 'Infrastructure', name: 'Database reachable' },
  { id: 'auth',         category: 'Infrastructure', name: 'Authentication active' },
  { id: 'org',          category: 'Setup',          name: 'Organization configured' },
  { id: 'branding',     category: 'Setup',          name: 'Organization branding set (name + logo)' },
  { id: 'users',        category: 'Setup',          name: 'At least one active user with role' },
  { id: 'admin',        category: 'Setup',          name: 'At least one admin user' },
  { id: 'coa',          category: 'Finance',        name: 'Chart of Accounts seeded (≥ 20 accounts)' },
  { id: 'coa_types',    category: 'Finance',        name: 'COA covers all 5 account types' },
  { id: 'fiscal',       category: 'Finance',        name: 'Fiscal periods generated for current year' },
  { id: 'fiscal_open',  category: 'Finance',        name: 'Current period is open' },
  { id: 'gl_balance',   category: 'Finance',        name: 'Posted GL entries balance to zero' },
  { id: 'unbal_drafts', category: 'Finance',        name: 'No unbalanced posted journal entries' },
  { id: 'tax',          category: 'Finance',        name: 'Tax configuration exists' },
  { id: 'currency',     category: 'Finance',        name: 'Default currency set' },
  { id: 'bank',         category: 'Finance',        name: 'At least one bank account' },
  { id: 'vendors',      category: 'Master Data',    name: 'At least one active vendor' },
  { id: 'customers',    category: 'Master Data',    name: 'At least one active customer' },
  { id: 'items',        category: 'Master Data',    name: 'At least one active item' },
  { id: 'locations',    category: 'Master Data',    name: 'At least one active location' },
  { id: 'departments',  category: 'Master Data',    name: 'At least one department' },
  { id: 'neg_inv',      category: 'Inventory',      name: 'No negative on-hand inventory balances' },
  { id: 'approval',     category: 'Workflows',      name: 'Approval rules configured' },
  { id: 'backups',      category: 'Resilience',     name: 'At least one recent backup (≤ 30 days)' },
  { id: 'opening_bal',  category: 'Cutover',        name: 'Opening trial balance posted (if using cutover)' },
];

const CATEGORY_ORDER = [
  'Infrastructure', 'Setup', 'Finance', 'Master Data', 'Inventory', 'Workflows', 'Resilience', 'Cutover',
];

export default function SystemHealthCheck() {
  const { organizationId, isAdmin } = useAuth();
  const [checks, setChecks] = useState<Check[]>(
    initialChecks.map(c => ({ ...c, status: 'pending' as Status, message: '' })),
  );
  const [running, setRunning] = useState(false);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  const update = (id: string, status: Status, message: string, fix?: string) =>
    setChecks(prev => prev.map(c => (c.id === id ? { ...c, status, message, fix } : c)));

  const countRows = async (table: string, extraFilter?: (q: any) => any) => {
    let q = supabase.from(table as any).select('*', { count: 'exact', head: true });
    if (organizationId) q = q.eq('organization_id', organizationId);
    if (extraFilter) q = extraFilter(q);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  };

  const runAll = async () => {
    if (!organizationId) {
      toast.error('No organization loaded — sign in as an admin.');
      return;
    }
    setRunning(true);
    setChecks(prev => prev.map(c => ({ ...c, status: 'pending', message: 'Running…' })));

    try {
      // DB reachable
      try {
        const { error } = await supabase.from('organizations').select('id').limit(1);
        if (error) throw error;
        update('db', 'pass', 'Database responds.');
      } catch (e: any) {
        update('db', 'fail', `DB error: ${e.message}`, 'Check Cloud status in Backend panel.');
      }

      // Auth
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) update('auth', 'pass', `Logged in as ${sess.session.user.email}.`);
      else update('auth', 'fail', 'No session.', 'Sign in as an admin.');

      // Org
      const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
      if (!org) update('org', 'fail', 'Organization row missing.', 'Complete Organization Setup.');
      else update('org', 'pass', `Org: ${(org as any).app_name || org.name || 'unnamed'}.`);

      // Branding
      const brandOk = !!((org as any)?.app_name && (org as any)?.logo_url);
      if (brandOk) update('branding', 'pass', 'Name + logo set.');
      else update('branding', 'warn', 'Missing name or logo.', 'Admin → Organization Branding.');

      // Users & admin
      const { data: profiles } = await supabase.from('profiles').select('user_id').eq('organization_id', organizationId);
      const userIds = (profiles || []).map((p: any) => p.user_id);
      if (userIds.length === 0) update('users', 'fail', 'No users in org.', 'Invite users via User Management.');
      else update('users', 'pass', `${userIds.length} user(s).`);

      if (userIds.length > 0) {
        const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').in('user_id', userIds);
        if ((adminRoles?.length || 0) > 0) update('admin', 'pass', `${adminRoles!.length} admin(s).`);
        else update('admin', 'fail', 'No admin role assigned.', 'Assign admin in User Management.');
      } else {
        update('admin', 'fail', 'No users — no admin.', 'Invite an admin user first.');
      }

      // COA
      const coaCount = await countRows('gl_accounts');
      if (coaCount >= 20) update('coa', 'pass', `${coaCount} accounts.`);
      else if (coaCount > 0) update('coa', 'warn', `Only ${coaCount} accounts.`, 'Seed a full Chart of Accounts.');
      else update('coa', 'fail', 'No accounts.', 'Admin → seed Chart of Accounts.');

      // COA types
      const { data: coaTypes } = await supabase.from('gl_accounts').select('account_type').eq('organization_id', organizationId);
      const types = new Set((coaTypes || []).map((r: any) => r.account_type));
      const need = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      const missing = need.filter(t => !types.has(t));
      if (missing.length === 0) update('coa_types', 'pass', 'All 5 types present.');
      else update('coa_types', 'warn', `Missing: ${missing.join(', ')}.`, 'Add missing account types.');

      // Fiscal periods
      const thisYear = new Date().getFullYear();
      const { data: periods } = await supabase
        .from('gl_fiscal_periods')
        .select('id, status, start_date, end_date')
        .eq('organization_id', organizationId)
        .gte('start_date', `${thisYear}-01-01`)
        .lte('end_date', `${thisYear}-12-31`);
      if ((periods?.length || 0) >= 12) update('fiscal', 'pass', `${periods!.length} periods for ${thisYear}.`);
      else if ((periods?.length || 0) > 0) update('fiscal', 'warn', `Only ${periods!.length} periods for ${thisYear}.`, 'Fiscal Periods → Generate.');
      else update('fiscal', 'fail', `No periods for ${thisYear}.`, 'Fiscal Periods → Generate Periods.');

      const today = new Date().toISOString().slice(0, 10);
      const currentPeriod = (periods || []).find((p: any) => p.start_date <= today && p.end_date >= today);
      if (!currentPeriod) update('fiscal_open', 'warn', 'No period covers today.', 'Generate current-year periods.');
      else if (currentPeriod.status === 'open') update('fiscal_open', 'pass', 'Current period open.');
      else update('fiscal_open', 'fail', `Current period is ${currentPeriod.status}.`, 'Reopen the current period.');

      // GL balance (posted)
      const { data: postedLines } = await supabase
        .from('gl_journal_lines')
        .select('debit, credit, gl_journal_entries!inner(status, organization_id)')
        .eq('gl_journal_entries.organization_id', organizationId)
        .eq('gl_journal_entries.status', 'posted')
        .limit(50000);
      const totDr = (postedLines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totCr = (postedLines || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      const diff = Math.abs(totDr - totCr);
      if (diff < 0.01) update('gl_balance', 'pass', `DR = CR = ${totDr.toFixed(2)}.`);
      else update('gl_balance', 'fail', `Out of balance by ${diff.toFixed(2)}.`, 'Investigate posted entries with unbalanced lines.');

      // Unbalanced posted entries
      const { data: entries } = await supabase
        .from('gl_journal_entries')
        .select('id, total_debit, total_credit')
        .eq('organization_id', organizationId)
        .eq('status', 'posted')
        .limit(5000);
      const bad = (entries || []).filter((e: any) => Math.abs(Number(e.total_debit || 0) - Number(e.total_credit || 0)) > 0.01);
      if (bad.length === 0) update('unbal_drafts', 'pass', 'All posted entries balanced.');
      else update('unbal_drafts', 'fail', `${bad.length} unbalanced.`, 'Reverse & repost.');

      // Tax
      const taxCount = await countRows('tax_configuration').catch(() => 0);
      if (taxCount > 0) update('tax', 'pass', `${taxCount} tax rule(s).`);
      else update('tax', 'warn', 'No tax rules.', 'Tax Configuration.');

      // Currency
      const curr = (org as any)?.base_currency || (org as any)?.currency;
      if (curr) update('currency', 'pass', `Base: ${curr}.`);
      else update('currency', 'warn', 'No base currency.', 'Admin → Currency Settings.');

      // Bank
      const bankCount = await countRows('bank_accounts');
      if (bankCount > 0) update('bank', 'pass', `${bankCount} bank account(s).`);
      else update('bank', 'warn', 'No bank accounts.', 'Add a bank account.');

      // Master data
      const [vc, cc, ic, lc, dc] = await Promise.all([
        countRows('vendors').catch(() => 0),
        countRows('customers').catch(() => 0),
        countRows('items').catch(() => 0),
        countRows('locations').catch(() => 0),
        countRows('departments').catch(() => 0),
      ]);
      update('vendors',    vc > 0 ? 'pass' : 'warn', vc > 0 ? `${vc} vendor(s).`    : 'None.', vc === 0 ? 'Add vendors.'    : undefined);
      update('customers',  cc > 0 ? 'pass' : 'warn', cc > 0 ? `${cc} customer(s).`  : 'None.', cc === 0 ? 'Add customers.'  : undefined);
      update('items',      ic > 0 ? 'pass' : 'warn', ic > 0 ? `${ic} item(s).`      : 'None.', ic === 0 ? 'Add items.'      : undefined);
      update('locations',  lc > 0 ? 'pass' : 'warn', lc > 0 ? `${lc} location(s).`  : 'None.', lc === 0 ? 'Add locations.'  : undefined);
      update('departments',dc > 0 ? 'pass' : 'warn', dc > 0 ? `${dc} department(s).`: 'None.', dc === 0 ? 'Add departments.': undefined);

      // Negative inventory
      const { data: negInv } = await supabase
        .from('inventory_balances')
        .select('item_id, location_id, quantity')
        .eq('organization_id', organizationId)
        .lt('quantity', 0)
        .limit(50);
      if ((negInv?.length || 0) === 0) update('neg_inv', 'pass', 'No negatives.');
      else update('neg_inv', 'fail', `${negInv!.length} negative balance(s).`, 'Reconcile inventory.');

      // Approval rules
      const apprCount = await countRows('approval_rules').catch(() => 0);
      if (apprCount > 0) update('approval', 'pass', `${apprCount} rule(s).`);
      else update('approval', 'warn', 'No approval rules.', 'Approval Rules page.');

      // Backups
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: bks } = await supabase
        .from('data_backups')
        .select('id, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1);
      if ((bks?.length || 0) > 0) update('backups', 'pass', `Last: ${new Date(bks![0].created_at).toLocaleDateString()}.`);
      else update('backups', 'warn', 'No backup in last 30 days.', 'Admin → Backup & Restore → Create Backup.');

      // Opening trial balance (only warn — cutover is optional)
      const { data: openingJE } = await (supabase as any)
        .from('gl_journal_entries')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_opening_balance', true)
        .limit(1);
      if ((openingJE?.length || 0) > 0) update('opening_bal', 'pass', 'Opening trial balance posted.');
      else update('opening_bal', 'warn', 'No opening trial balance posted.', 'If migrating from another system, use Opening Balances.');

      setRanAt(new Date());
      toast.success('Health check complete.');
    } catch (e: any) {
      toast.error(e.message || 'Health check failed.');
    } finally {
      setRunning(false);
    }
  };

  const stats = {
    pass: checks.filter(c => c.status === 'pass').length,
    warn: checks.filter(c => c.status === 'warn').length,
    fail: checks.filter(c => c.status === 'fail').length,
    total: checks.length,
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: checks.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0);

  const statusIcon = (s: Status) => {
    if (s === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === 'warn') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    if (s === 'fail') return <XCircle className="h-4 w-4 text-red-600" />;
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Admin access required.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            System Health Check
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One-click UAT smoke test — verifies your ERP is ready for production.
          </p>
        </div>
        <Button onClick={runAll} disabled={running} size="lg" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running…' : ranAt ? 'Re-run' : 'Run Health Check'}
        </Button>
      </div>

      {ranAt && (
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Passed</div><div className="text-2xl font-bold text-green-600">{stats.pass}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Warnings</div><div className="text-2xl font-bold text-yellow-600">{stats.warn}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Failed</div><div className="text-2xl font-bold text-red-600">{stats.fail}</div></CardContent></Card>
        </div>
      )}

      {ranAt && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-3 w-3" />
          Last run: {ranAt.toLocaleString()}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.category}>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">
                    {group.category}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map(c => (
                      <div key={c.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                        <div className="mt-0.5">{statusIcon(c.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{c.name}</span>
                            {c.status !== 'pending' && (
                              <Badge variant={
                                c.status === 'pass' ? 'default' :
                                c.status === 'warn' ? 'secondary' :
                                'destructive'
                              } className="text-xs">
                                {c.status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          {c.message && <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>}
                          {c.fix && c.status !== 'pass' && (
                            <div className="text-xs text-blue-600 mt-0.5">💡 {c.fix}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 text-sm">
          <div className="font-semibold mb-1">How to read this report</div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li><b className="text-green-600">PASS</b> — this area is production-ready.</li>
            <li><b className="text-yellow-600">WARN</b> — non-blocking. Fix if the module is in scope for go-live.</li>
            <li><b className="text-red-600">FAIL</b> — blocking. Resolve before going live.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

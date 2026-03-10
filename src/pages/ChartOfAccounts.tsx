import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, ChevronRight, ChevronDown, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { seedBasicChartOfAccounts } from '@/lib/seed-coa';

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: string | null;
  is_active: boolean;
  is_header: boolean;
  description: string | null;
  normal_balance: string;
  children?: GLAccount[];
}

const accountTypeColors: Record<string, string> = {
  asset: 'bg-info/10 text-info border-info/20',
  liability: 'bg-warning/10 text-warning border-warning/20',
  equity: 'bg-primary/10 text-primary border-primary/20',
  revenue: 'bg-success/10 text-success border-success/20',
  expense: 'bg-destructive/10 text-destructive border-destructive/20',
};

function buildTree(accounts: GLAccount[]): GLAccount[] {
  const map = new Map<string, GLAccount>();
  const roots: GLAccount[] = [];
  
  accounts.forEach(a => map.set(a.id, { ...a, children: [] }));
  accounts.forEach(a => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}

function AccountRow({ account, level, expanded, onToggle, searchMatch }: { 
  account: GLAccount; level: number; expanded: Set<string>; onToggle: (id: string) => void; searchMatch: boolean;
}) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expanded.has(account.id);

  return (
    <>
      <tr className={cn(
        'hover:bg-muted/50 transition-colors',
        account.is_header && 'font-semibold',
        !account.is_active && 'opacity-50',
        searchMatch && 'bg-primary/5'
      )}>
        <td className="px-4 py-2.5 text-sm" style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => onToggle(account.id)} className="p-0.5 rounded hover:bg-muted">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : <span className="w-5" />}
            <span className="font-mono text-xs text-muted-foreground mr-2">{account.account_code}</span>
            <span>{account.account_name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <Badge variant="outline" className={cn('text-xs capitalize', accountTypeColors[account.account_type])}>
            {account.account_type}
          </Badge>
        </td>
        <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{account.normal_balance}</td>
        <td className="px-4 py-2.5 text-sm">
          {account.is_header ? (
            <Badge variant="outline" className="text-xs">Header</Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Posting</Badge>
          )}
        </td>
        <td className="px-4 py-2.5 text-sm text-muted-foreground">{account.description || '—'}</td>
      </tr>
      {isExpanded && account.children?.map(child => (
        <AccountRow key={child.id} account={child} level={level + 1} expanded={expanded} onToggle={onToggle} searchMatch={false} />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [tree, setTree] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    account_code: '', account_name: '', account_type: 'asset' as string, 
    parent_id: '', is_header: false, description: '', normal_balance: 'debit',
  });

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('gl_accounts')
      .select('*')
      .order('account_code');
    if (error) { toast.error('Failed to load accounts'); return; }
    setAccounts(data || []);
    const built = buildTree((data || []) as GLAccount[]);
    setTree(built);
    // Expand top-level by default
    setExpanded(new Set((data || []).filter((a: any) => !a.parent_id).map((a: any) => a.id)));
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(accounts.map(a => a.id)));
  const collapseAll = () => setExpanded(new Set());

  const handleSeedCOA = async () => {
    if (!hasRole('admin')) { toast.error('Only admins can seed the Chart of Accounts'); return; }
    // Get current user's org id
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').single();
    if (!profile?.organization_id) { toast.error('No organization found'); return; }
    
    setSeeding(true);
    const err = await seedBasicChartOfAccounts(profile.organization_id);
    setSeeding(false);
    if (err) { toast.error(err); return; }
    toast.success('Basic Chart of Accounts created successfully');
    fetchAccounts();
  };

  const handleCreate = async () => {
    if (!form.account_code || !form.account_name) { toast.error('Code and name required'); return; }
    const { error } = await supabase.from('gl_accounts').insert({
      account_code: form.account_code,
      account_name: form.account_name,
      account_type: form.account_type as any,
      parent_id: form.parent_id || null,
      is_header: form.is_header,
      description: form.description || null,
      normal_balance: form.normal_balance,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Account created');
    setDialogOpen(false);
    setForm({ account_code: '', account_name: '', account_type: 'asset', parent_id: '', is_header: false, description: '', normal_balance: 'debit' });
    fetchAccounts();
  };

  const filteredTree = search
    ? accounts.filter(a => 
        a.account_code.toLowerCase().includes(search.toLowerCase()) || 
        a.account_name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader 
          title="Chart of Accounts"
          description="Manage your general ledger account structure"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
              {canManage && accounts.length === 0 && (
                <Button variant="secondary" size="sm" onClick={handleSeedCOA} disabled={seeding}>
                  <Sparkles className="h-4 w-4 mr-1" /> {seeding ? 'Seeding...' : 'Seed Basic COA'}
                </Button>
              )}
              {canManage && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Account</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New GL Account</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Account Code</Label><Input value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} placeholder="e.g. 1150" /></div>
                        <div><Label>Account Name</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="e.g. Savings Account" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Account Type</Label>
                          <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v, normal_balance: ['asset','expense'].includes(v) ? 'debit' : 'credit' }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">Asset</SelectItem>
                              <SelectItem value="liability">Liability</SelectItem>
                              <SelectItem value="equity">Equity</SelectItem>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Parent Account</Label>
                          <Select value={form.parent_id || 'none'} onValueChange={v => setForm(f => ({ ...f, parent_id: v === 'none' ? '' : v }))}>
                            <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (top-level)</SelectItem>
                              {accounts.filter(a => a.is_header).map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                      <div className="flex items-center gap-2">
                        <Switch checked={form.is_header} onCheckedChange={v => setForm(f => ({ ...f, is_header: v }))} />
                        <Label>Header Account (grouping only, no posting)</Label>
                      </div>
                      <Button onClick={handleCreate} className="w-full">Create Account</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 max-w-sm" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Normal Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Kind</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {search ? (
                    filteredTree.map(a => (
                      <tr key={a.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2.5 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{a.account_code}</span>
                          <span className={a.is_header ? 'font-semibold' : ''}>{a.account_name}</span>
                        </td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className={cn('text-xs capitalize', accountTypeColors[a.account_type])}>{a.account_type}</Badge></td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{a.normal_balance}</td>
                        <td className="px-4 py-2.5 text-sm">{a.is_header ? <Badge variant="outline" className="text-xs">Header</Badge> : <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Posting</Badge>}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.description || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    tree.map(a => (
                      <AccountRow key={a.id} account={a} level={0} expanded={expanded} onToggle={toggleExpand} searchMatch={false} />
                    ))
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

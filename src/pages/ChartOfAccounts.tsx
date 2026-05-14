import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, ChevronRight, ChevronDown, Search, Sparkles, Pencil, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { seedBasicChartOfAccounts } from '@/lib/seed-coa';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  status: string;
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

function AccountRow({ account, level, expanded, onToggle, onEdit, onDelete, onToggleActive, onApprove, canManage }: {
  account: GLAccount; level: number; expanded: Set<string>;
  onToggle: (id: string) => void; onEdit: (a: GLAccount) => void;
  onDelete: (a: GLAccount) => void; onToggleActive: (a: GLAccount) => void;
  onApprove: (a: GLAccount) => void; canManage: boolean;
}) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expanded.has(account.id);

  return (
    <>
      <tr className={cn(
        'hover:bg-muted/50 transition-colors',
        account.is_header && 'font-semibold',
        !account.is_active && 'opacity-50',
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
        <td className="px-4 py-2.5">
          <StatusBadge status={account.status} />
        </td>
        <td className="px-4 py-2.5 text-sm text-muted-foreground">{account.description || '—'}</td>
        {canManage && (
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-1">
              {account.status === 'draft' && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onApprove(account)} title="Approve">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(account)} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleActive(account)} title={account.is_active ? 'Disable' : 'Enable'}>
                <Ban className={cn("h-3.5 w-3.5", !account.is_active && "text-success")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(account)} title="Delete">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </td>
        )}
      </tr>
      {isExpanded && account.children?.map(child => (
        <AccountRow key={child.id} account={child} level={level + 1} expanded={expanded} onToggle={onToggle}
          onEdit={onEdit} onDelete={onDelete} onToggleActive={onToggleActive} onApprove={onApprove} canManage={canManage} />
      ))}
    </>
  );
}

const emptyForm = {
  account_code: '', account_name: '', account_type: 'asset' as string,
  parent_id: '', is_header: false, description: '', normal_balance: 'debit',
};

export default function ChartOfAccounts() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole('admin') || hasRole('accounts_payable');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GLAccount | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<GLAccount | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [form, setForm] = useState(emptyForm);

  const accountsQ = useQuery({
    queryKey: ['gl_accounts', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('*').order('account_code');
      if (error) throw error;
      return (data || []) as GLAccount[];
    },
  });
  const accounts = accountsQ.data || [];
  const tree = buildTree(accounts);
  const loading = accountsQ.isLoading;
  const fetchAccounts = () => qc.invalidateQueries({ queryKey: ['gl_accounts', 'all'] });

  // Auto-expand roots when accounts first load
  useEffect(() => {
    if (accounts.length && expanded.size === 0) {
      setExpanded(new Set(accounts.filter(a => !a.parent_id).map(a => a.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const expandAll = () => setExpanded(new Set(accounts.map(a => a.id)));
  const collapseAll = () => setExpanded(new Set());

  const handleSeedCOA = async () => {
    if (!hasRole('admin')) { toast.error('Only admins can seed the Chart of Accounts'); return; }
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').single();
    if (!profile?.organization_id) { toast.error('No organization found'); return; }
    setSeeding(true);
    const err = await seedBasicChartOfAccounts(profile.organization_id);
    setSeeding(false);
    if (err) { toast.error(err); return; }
    toast.success('Basic Chart of Accounts created successfully');
    fetchAccounts();
  };

  const openCreateDialog = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (account: GLAccount) => {
    setEditingAccount(account);
    setForm({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_id: account.parent_id || '',
      is_header: account.is_header,
      description: account.description || '',
      normal_balance: account.normal_balance,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.account_code || !form.account_name) { toast.error('Code and name required'); return; }

    if (editingAccount) {
      const { error } = await supabase.from('gl_accounts').update({
        account_code: form.account_code,
        account_name: form.account_name,
        account_type: form.account_type as any,
        parent_id: form.parent_id || null,
        is_header: form.is_header,
        description: form.description || null,
        normal_balance: form.normal_balance,
      }).eq('id', editingAccount.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Account updated');
    } else {
      const { error } = await supabase.from('gl_accounts').insert({
        account_code: form.account_code,
        account_name: form.account_name,
        account_type: form.account_type as any,
        parent_id: form.parent_id || null,
        is_header: form.is_header,
        description: form.description || null,
        normal_balance: form.normal_balance,
        status: 'draft',
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Account created as draft');
    }
    setDialogOpen(false);
    fetchAccounts();
  };

  const handleApprove = async (account: GLAccount) => {
    const { error } = await supabase.from('gl_accounts').update({ status: 'approved' }).eq('id', account.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${account.account_code} approved`);
    fetchAccounts();
  };

  const handleToggleActive = async (account: GLAccount) => {
    const newActive = !account.is_active;
    const { error } = await supabase.from('gl_accounts').update({ is_active: newActive }).eq('id', account.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${account.account_code} ${newActive ? 'enabled' : 'disabled'}`);
    fetchAccounts();
  };

  const handleDelete = async () => {
    if (!deleteAccount) return;
    // Check for transactions via RPC
    const { data: hasTxns, error: rpcErr } = await supabase.rpc('gl_account_has_transactions', { p_account_id: deleteAccount.id });
    if (rpcErr) { toast.error(rpcErr.message); return; }
    if (hasTxns) {
      toast.error(`Cannot delete account ${deleteAccount.account_code}: it has existing transactions. You can disable it instead.`);
      setDeleteAccount(null);
      return;
    }
    // Check for children
    const hasChildren = accounts.some(a => a.parent_id === deleteAccount.id);
    if (hasChildren) {
      toast.error(`Cannot delete account ${deleteAccount.account_code}: it has child accounts.`);
      setDeleteAccount(null);
      return;
    }
    const { error } = await supabase.from('gl_accounts').delete().eq('id', deleteAccount.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${deleteAccount.account_code} deleted`);
    setDeleteAccount(null);
    fetchAccounts();
  };

  const getFilteredAccounts = () => {
    let filtered = accounts;
    if (activeTab === 'draft') filtered = accounts.filter(a => a.status === 'draft');
    else if (activeTab === 'approved') filtered = accounts.filter(a => a.status === 'approved');
    else if (activeTab === 'inactive') filtered = accounts.filter(a => !a.is_active);

    if (search) {
      return filtered.filter(a =>
        a.account_code.toLowerCase().includes(search.toLowerCase()) ||
        a.account_name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return null; // use tree view
  };

  const getFilteredTree = () => {
    let filtered = accounts;
    if (activeTab === 'draft') return accounts.filter(a => a.status === 'draft');
    if (activeTab === 'approved') filtered = accounts.filter(a => a.status === 'approved');
    if (activeTab === 'inactive') return accounts.filter(a => !a.is_active);
    return null; // null means use full tree
  };

  const draftCount = accounts.filter(a => a.status === 'draft').length;
  const flatList = getFilteredAccounts();
  const useFlat = !!search || activeTab === 'draft' || activeTab === 'inactive';
  const displayAccounts = useFlat
    ? (search
        ? (flatList || [])
        : activeTab === 'draft'
          ? accounts.filter(a => a.status === 'draft')
          : activeTab === 'inactive'
            ? accounts.filter(a => !a.is_active)
            : [])
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
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-1" /> Add Account
                </Button>
              )}
            </div>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All Accounts</TabsTrigger>
            <TabsTrigger value="draft">
              Draft {draftCount > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">{draftCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>

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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                    {canManage && <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {useFlat ? (
                    displayAccounts.map(a => (
                      <tr key={a.id} className={cn('hover:bg-muted/50', !a.is_active && 'opacity-50')}>
                        <td className="px-4 py-2.5 text-sm">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{a.account_code}</span>
                          <span className={a.is_header ? 'font-semibold' : ''}>{a.account_name}</span>
                        </td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className={cn('text-xs capitalize', accountTypeColors[a.account_type])}>{a.account_type}</Badge></td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{a.normal_balance}</td>
                        <td className="px-4 py-2.5 text-sm">{a.is_header ? <Badge variant="outline" className="text-xs">Header</Badge> : <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Posting</Badge>}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.description || '—'}</td>
                        {canManage && (
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              {a.status === 'draft' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleApprove(a)} title="Approve">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(a)} title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(a)} title={a.is_active ? 'Disable' : 'Enable'}>
                                <Ban className={cn("h-3.5 w-3.5", !a.is_active && "text-success")} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteAccount(a)} title="Delete">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    tree.map(a => (
                      <AccountRow key={a.id} account={a} level={0} expanded={expanded} onToggle={toggleExpand}
                        onEdit={openEditDialog} onDelete={a => setDeleteAccount(a)} onToggleActive={handleToggleActive}
                        onApprove={handleApprove} canManage={canManage} />
                    ))
                  )}
                  {!loading && ((useFlat && displayAccounts.length === 0) || (!useFlat && tree.length === 0)) && (
                    <tr><td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">No accounts found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit GL Account' : 'New GL Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Account Code *</Label><Input value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} placeholder="e.g. 1150" /></div>
              <div><Label>Account Name *</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="e.g. Savings Account" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Type</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v, normal_balance: ['asset', 'expense'].includes(v) ? 'debit' : 'credit' }))}>
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
                    {accounts.filter(a => a.is_header && a.id !== editingAccount?.id).map(a => (
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingAccount ? 'Update Account' : 'Create Account (Draft)'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAccount} onOpenChange={open => !open && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete account <strong>{deleteAccount?.account_code} - {deleteAccount?.account_name}</strong>. 
              Accounts with existing transactions cannot be deleted — consider disabling instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

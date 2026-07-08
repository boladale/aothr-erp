import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, PackageMinus, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getNextTransactionNumber } from '@/lib/transaction-numbers';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface IssueLine {
  item_id: string;
  quantity: number;
  target_gl_account_id: string;
  description: string;
}

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
}

interface Item {
  id: string;
  code: string;
  name: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface IssueRow {
  id: string;
  issue_number: string;
  issue_date: string;
  issued_to: string | null;
  department: string | null;
  status: string;
  location_id: string;
  project_id: string | null;
  notes: string | null;
  created_at: string;
  locations: { name: string } | null;
  projects: { project_code: string; project_name: string } | null;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
}

export default function InventoryIssues() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    location_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    issued_to: '',
    department: '',
    project_id: 'none',
    notes: '',
  });
  const [lines, setLines] = useState<IssueLine[]>([
    { item_id: '', quantity: 1, target_gl_account_id: '', description: '' },
  ]);

  const issuesQ = useQuery({
    queryKey: ['inventory_issues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_issues').select('*, locations(name), projects(project_code, project_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as IssueRow[];
    },
  });
  const issueJEsQ = useQuery({
    queryKey: ['inventory_issue_jes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('gl_journal_entries')
        .select('id, entry_number, source_id, status, gl_journal_lines(debit)')
        .eq('source_module', 'inventory');
      if (error) return [] as any[];
      return data || [];
    },
  });
  const jeByIssue: Record<string, { entry_number: string; total: number; status: string; id: string }> = {};
  (issueJEsQ.data || []).forEach((je: any) => {
    const total = (je.gl_journal_lines || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
    jeByIssue[je.source_id] = { entry_number: je.entry_number, total, status: je.status, id: je.id };
  });
  const itemsQ = useQuery({
    queryKey: ['items-active-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('id, code, name').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as Item[];
    },
  });
  const locationsQ = useQuery({
    queryKey: ['locations-active-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, code, name').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []) as Location[];
    },
  });
  const projectsQ = useQuery({
    queryKey: ['projects-active-min'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, project_code, project_name, status').not('status', 'in', '(completed,cancelled,closed)').order('project_name');
      if (error) return [] as Project[];
      return (data || []) as Project[];
    },
  });
  const departmentsQ = useQuery({
    queryKey: ['departments-active-min'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('departments' as any) as any).select('id, name').eq('is_active', true).order('name');
      if (error) return [] as { id: string; name: string }[];
      return (data || []) as { id: string; name: string }[];
    },
  });
  const glAccountsQ = useQuery({
    queryKey: ['gl_accounts-leaf-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_active', true).eq('is_header', false).order('account_code');
      if (error) throw error;
      return (data || []) as GLAccount[];
    },
  });
  const issues = issuesQ.data || [];
  const items = itemsQ.data || [];
  const locations = locationsQ.data || [];
  const projects = projectsQ.data || [];
  const glAccounts = glAccountsQ.data || [];
  const loading = issuesQ.isLoading;

  const addLine = () => setLines([...lines, { item_id: '', quantity: 1, target_gl_account_id: '', description: '' }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof IssueLine, value: string | number) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    setLines(updated);
  };

  const generateIssueNumber = async () => {
    return await getNextTransactionNumber(organizationId!, 'ISS', 'ISS');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const issueNumber = await generateIssueNumber();
      const { data: issue, error: issueErr } = await supabase
        .from('inventory_issues')
        .insert({
          issue_number: issueNumber,
          location_id: form.location_id,
          issue_date: form.issue_date,
          issued_to: form.issued_to || null,
          department: form.department || null,
          project_id: form.project_id && form.project_id !== 'none' ? form.project_id : null,
          notes: form.notes || null,
          organization_id: organizationId,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (issueErr) throw issueErr;

      const lineInserts = lines.map(l => ({
        issue_id: issue.id,
        item_id: l.item_id,
        quantity: l.quantity,
        target_gl_account_id: l.target_gl_account_id,
        description: l.description || null,
      }));
      const { error: linesErr } = await supabase.from('inventory_issue_lines').insert(lineInserts);
      if (linesErr) throw linesErr;
      return issueNumber;
    },
    onSuccess: (issueNumber) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_issues'] }); queryClient.invalidateQueries({ queryKey: ['inventory_issue_jes'] });
      toast.success(`Issue ${issueNumber} created as draft`);
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create issue'),
  });
  const saving = createMutation.isPending;

  const handleCreate = () => {
    if (!form.location_id) { toast.error('Select a warehouse location'); return; }
    if (lines.some(l => !l.item_id || l.quantity <= 0)) { toast.error('Fill all item lines with valid quantities'); return; }
    if (lines.some(l => !l.target_gl_account_id)) { toast.error('Select a GL account for each line'); return; }
    createMutation.mutate();
  };

  const postMutation = useMutation({
    mutationFn: async (issue: IssueRow) => {
      const { error } = await supabase.from('inventory_issues').update({ status: 'posted' }).eq('id', issue.id);
      if (error) throw error;
      return issue.issue_number;
    },
    onSuccess: (num) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_issues'] }); queryClient.invalidateQueries({ queryKey: ['inventory_issue_jes'] });
      toast.success(`Issue ${num} posted — inventory reduced & GL entries created`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to post issue'),
  });
  const handlePost = (issue: IssueRow) => postMutation.mutate(issue);

  const resetForm = () => {
    setForm({ location_id: '', issue_date: new Date().toISOString().split('T')[0], issued_to: '', department: '', project_id: 'none', notes: '' });
    setLines([{ item_id: '', quantity: 1, target_gl_account_id: '', description: '' }]);
  };

  // ---- ISS-05: Return / Reverse ----
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnIssue, setReturnIssue] = useState<IssueRow | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnReason, setReturnReason] = useState('');
  const [returnLines, setReturnLines] = useState<Array<{
    issue_line_id: string; item_id: string; item_label: string;
    issued_qty: number; already_returned: number; return_qty: number;
  }>>([]);

  const openReturnDialog = (issue: IssueRow) => {
    setReturnIssue(issue);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnReason('');
    setReturnLines([]);
    setReturnDialogOpen(true);
  };

  useEffect(() => {
    if (!returnDialogOpen || !returnIssue) return;
    (async () => {
      const { data: issueLines } = await (supabase as any)
        .from('inventory_issue_lines')
        .select('id, item_id, quantity, items(code, name)')
        .eq('issue_id', returnIssue.id);
      const lineIds = (issueLines || []).map((l: any) => l.id);
      let returnedMap: Record<string, number> = {};
      if (lineIds.length) {
        const { data: prevReturns } = await (supabase as any)
          .from('inventory_issue_return_lines')
          .select('issue_line_id, quantity, inventory_issue_returns!inner(status)')
          .in('issue_line_id', lineIds)
          .eq('inventory_issue_returns.status', 'posted');
        (prevReturns || []).forEach((r: any) => {
          returnedMap[r.issue_line_id] = (returnedMap[r.issue_line_id] || 0) + Number(r.quantity);
        });
      }
      setReturnLines((issueLines || []).map((l: any) => ({
        issue_line_id: l.id,
        item_id: l.item_id,
        item_label: `${l.items?.code || ''} - ${l.items?.name || ''}`,
        issued_qty: Number(l.quantity),
        already_returned: returnedMap[l.id] || 0,
        return_qty: 0,
      })));
    })();
  }, [returnDialogOpen, returnIssue]);

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returnIssue) throw new Error('No issue selected');
      const toReturn = returnLines.filter(l => l.return_qty > 0);
      if (toReturn.length === 0) throw new Error('Enter at least one return quantity');
      for (const l of toReturn) {
        const remaining = l.issued_qty - l.already_returned;
        if (l.return_qty > remaining) {
          throw new Error(`Cannot return more than ${remaining} for ${l.item_label}`);
        }
      }
      const returnNumber = await getNextTransactionNumber(organizationId!, 'IRT', 'IRT');
      const { data: ret, error: retErr } = await (supabase as any)
        .from('inventory_issue_returns')
        .insert({
          return_number: returnNumber,
          issue_id: returnIssue.id,
          return_date: returnDate,
          reason: returnReason || null,
          organization_id: organizationId,
          created_by: user?.id,
        })
        .select()
        .single();
      if (retErr) throw retErr;

      const lineInserts = toReturn.map(l => ({
        return_id: ret.id,
        issue_line_id: l.issue_line_id,
        item_id: l.item_id,
        quantity: l.return_qty,
      }));
      const { error: linesErr } = await (supabase as any)
        .from('inventory_issue_return_lines')
        .insert(lineInserts);
      if (linesErr) {
        await (supabase as any).from('inventory_issue_returns').delete().eq('id', ret.id);
        throw linesErr;
      }

      const { error: postErr } = await (supabase as any)
        .from('inventory_issue_returns')
        .update({ status: 'posted' })
        .eq('id', ret.id);
      if (postErr) throw postErr;
      return returnNumber;
    },
    onSuccess: (num) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_issues'] }); queryClient.invalidateQueries({ queryKey: ['inventory_issue_jes'] });
      toast.success(`Return ${num} posted — inventory restored & GL reversed`);
      setReturnDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to post return'),
  });


  const filtered = issues.filter(i =>
    i.issue_number.toLowerCase().includes(search.toLowerCase()) ||
    (i.issued_to || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.department || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'issue_number', header: 'Issue #' },
    { key: 'issue_date', header: 'Date', render: (row: IssueRow) => format(new Date(row.issue_date), 'dd MMM yyyy') },
    { key: 'location', header: 'Location', render: (row: IssueRow) => row.locations?.name || '-' },
    { key: 'issued_to', header: 'Issued To', render: (row: IssueRow) => row.issued_to || '-' },
    { key: 'department', header: 'Department', render: (row: IssueRow) => row.department || '-' },
    { key: 'project', header: 'Project', render: (row: IssueRow) => row.projects ? `${row.projects.project_code} - ${row.projects.project_name}` : '-' },
    { key: 'status', header: 'Status', render: (row: IssueRow) => <StatusBadge status={row.status} /> },
    {
      key: 'gl',
      header: 'GL Entry',
      render: (row: IssueRow) => {
        const je = jeByIssue[row.id];
        if (!je) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <a href="/journal-entries" className="text-xs text-primary hover:underline" title={`Dr Expense / Cr Inventory ${je.total.toLocaleString(undefined,{minimumFractionDigits:2})}`}>
            {je.entry_number} ({je.status})
          </a>
        );
      },
    },
    {
      key: 'actions', header: 'Actions',
      render: (row: IssueRow) => row.status === 'draft' ? (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePost(row); }}>Post</Button>
      ) : (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openReturnDialog(row); }}>
          <Undo2 className="mr-1 h-3 w-3" /> Return
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Inventory Issues" description="Issue items from warehouse to staff or departments" actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Issue
          </Button>
        } />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <DataTable columns={columns} data={filtered} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageMinus className="h-5 w-5" /> New Inventory Issue
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Warehouse Location *</Label>
                <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Issued To (Person)</Label>
                <Input value={form.issued_to} onChange={e => setForm({ ...form, issued_to: e.target.value })} placeholder="e.g. John Smith" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. IT, Finance" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Project (optional)</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_code} - {p.project_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">If set, the issue cost is recorded as a material cost on the project (feeds Project P&L).</p>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Items to Issue</Label>
                <Button variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-3 w-3" /> Add Line</Button>
              </div>

              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Item *</Label>
                    <Select value={line.item_id} onValueChange={v => updateLine(i, 'item_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.map(it => <SelectItem key={it.id} value={it.id}>{it.code} - {it.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty *</Label>
                    <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">GL Account *</Label>
                    <Select value={line.target_gl_account_id} onValueChange={v => updateLine(i, 'target_gl_account_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Target account" /></SelectTrigger>
                      <SelectContent>
                        {glAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create Issue (Draft)'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5" /> Return Items — {returnIssue?.issue_number}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Date</Label>
                <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="e.g. Unused, damaged" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label className="text-base font-semibold">Items to Return</Label>
              {returnLines.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading issue lines…</p>
              )}
              {returnLines.map((l, idx) => {
                const remaining = l.issued_qty - l.already_returned;
                return (
                  <div key={l.issue_line_id} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30">
                    <div className="col-span-6">
                      <Label className="text-xs">Item</Label>
                      <div className="text-sm font-medium">{l.item_label}</div>
                    </div>
                    <div className="col-span-3 text-xs">
                      <div>Issued: <span className="font-medium">{l.issued_qty}</span></div>
                      <div>Already returned: <span className="font-medium">{l.already_returned}</span></div>
                      <div>Available: <span className="font-medium text-primary">{remaining}</span></div>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Return Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={l.return_qty}
                        disabled={remaining <= 0}
                        onChange={e => {
                          const v = Math.max(0, Math.min(remaining, Number(e.target.value) || 0));
                          setReturnLines(prev => prev.map((p, i) => i === idx ? { ...p, return_qty: v } : p));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">Posting restores inventory, reverses the GL entry for the returned quantity, and refunds project material cost (if linked).</p>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
                {returnMutation.isPending ? 'Posting…' : 'Post Return'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </AppLayout>
  );
}

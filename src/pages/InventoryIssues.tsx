import { useEffect, useState } from 'react';
import { Plus, Search, PackageMinus, Trash2 } from 'lucide-react';
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
  notes: string | null;
  created_at: string;
  locations: { name: string } | null;
}

export default function InventoryIssues() {
  const { user, organizationId } = useAuth();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [glAccounts, setGlAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    location_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    issued_to: '',
    department: '',
    notes: '',
  });
  const [lines, setLines] = useState<IssueLine[]>([
    { item_id: '', quantity: 1, target_gl_account_id: '', description: '' },
  ]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [issuesRes, itemsRes, locsRes, glRes] = await Promise.all([
        supabase.from('inventory_issues').select('*, locations(name)').order('created_at', { ascending: false }),
        supabase.from('items').select('id, code, name').eq('is_active', true).order('name'),
        supabase.from('locations').select('id, code, name').eq('is_active', true).order('name'),
        supabase.from('gl_accounts').select('id, account_code, account_name').eq('is_active', true).eq('is_header', false).order('account_code'),
      ]);
      setIssues((issuesRes.data || []) as IssueRow[]);
      setItems((itemsRes.data || []) as Item[]);
      setLocations((locsRes.data || []) as Location[]);
      setGlAccounts((glRes.data || []) as GLAccount[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => setLines([...lines, { item_id: '', quantity: 1, target_gl_account_id: '', description: '' }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(lines.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof IssueLine, value: string | number) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    setLines(updated);
  };

  const generateIssueNumber = () => {
    const ts = Date.now().toString(36).toUpperCase();
    return `ISS-${ts}`;
  };

  const handleCreate = async () => {
    if (!form.location_id) { toast.error('Select a warehouse location'); return; }
    if (lines.some(l => !l.item_id || l.quantity <= 0)) { toast.error('Fill all item lines with valid quantities'); return; }
    if (lines.some(l => !l.target_gl_account_id)) { toast.error('Select a GL account for each line'); return; }

    setSaving(true);
    try {
      const issueNumber = generateIssueNumber();
      const { data: issue, error: issueErr } = await supabase
        .from('inventory_issues')
        .insert({
          issue_number: issueNumber,
          location_id: form.location_id,
          issue_date: form.issue_date,
          issued_to: form.issued_to || null,
          department: form.department || null,
          notes: form.notes || null,
          organization_id: organizationId,
          created_by: user?.id,
        })
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

      toast.success(`Issue ${issueNumber} created as draft`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to create issue');
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (issue: IssueRow) => {
    try {
      const { error } = await supabase
        .from('inventory_issues')
        .update({ status: 'posted' })
        .eq('id', issue.id);
      if (error) throw error;
      toast.success(`Issue ${issue.issue_number} posted — inventory reduced & GL entries created`);
      fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to post issue');
    }
  };

  const resetForm = () => {
    setForm({ location_id: '', issue_date: new Date().toISOString().split('T')[0], issued_to: '', department: '', notes: '' });
    setLines([{ item_id: '', quantity: 1, target_gl_account_id: '', description: '' }]);
  };

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
    { key: 'status', header: 'Status', render: (row: IssueRow) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: 'Actions',
      render: (row: IssueRow) => row.status === 'draft' ? (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePost(row); }}>Post</Button>
      ) : <span className="text-xs text-muted-foreground">Posted</span>,
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
      </div>
    </AppLayout>
  );
}

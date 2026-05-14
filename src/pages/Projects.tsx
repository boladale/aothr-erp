import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FolderKanban } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  description: string | null;
  status: string;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  budgeted_amount: number;
  total_costs: number;
  total_revenue: number;
  profit_margin: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-primary/10 text-primary',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function Projects() {
  const { user, organizationId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_code: '',
    project_name: '',
    description: '',
    status: 'planning',
    client_name: '',
    start_date: '',
    end_date: '',
    budgeted_amount: 0,
  });

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Project[];
    },
  });
  const projects = projectsQ.data || [];
  const loading = projectsQ.isLoading;
  const fetchProjects = () => qc.invalidateQueries({ queryKey: ['projects'] });

  const handleCreate = async () => {
    if (!form.project_code || !form.project_name) {
      toast.error('Project code and name are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('projects').insert({
        project_code: form.project_code,
        project_name: form.project_name,
        description: form.description || null,
        status: form.status as any,
        client_name: form.client_name || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budgeted_amount: form.budgeted_amount,
        created_by: user?.id, organization_id: organizationId,
      });
      if (error) throw error;
      toast.success('Project created');
      setDialogOpen(false);
      setForm({ project_code: '', project_name: '', description: '', status: 'planning', client_name: '', start_date: '', end_date: '', budgeted_amount: 0 });
      fetchProjects();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const filtered = projects.filter(p =>
    p.project_name.toLowerCase().includes(search.toLowerCase()) ||
    p.project_code.toLowerCase().includes(search.toLowerCase()) ||
    (p.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget = projects.filter(p => p.status === 'active').reduce((s, p) => s + p.budgeted_amount, 0);
  const totalCosts = projects.filter(p => p.status === 'active').reduce((s, p) => s + p.total_costs, 0);
  const activeCount = projects.filter(p => p.status === 'active').length;

  const columns = [
    {
      key: 'code',
      header: 'Project',
      render: (p: Project) => (
        <div>
          <p className="font-medium">{p.project_name}</p>
          <p className="text-xs text-muted-foreground">{p.project_code}</p>
        </div>
      ),
    },
    { key: 'client', header: 'Client', render: (p: Project) => p.client_name || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (p: Project) => (
        <Badge className={statusColors[p.status] || ''} variant="outline">
          {p.status.replace('_', ' ')}
        </Badge>
      ),
    },
    { key: 'budget', header: 'Budget', render: (p: Project) => formatCurrency(p.budgeted_amount) },
    { key: 'costs', header: 'Actual Costs', render: (p: Project) => formatCurrency(p.total_costs) },
    {
      key: 'variance',
      header: 'Variance',
      render: (p: Project) => {
        const v = p.budgeted_amount - p.total_costs;
        return <span className={v >= 0 ? 'text-green-600' : 'text-destructive'}>{formatCurrency(v)}</span>;
      },
    },
    {
      key: 'utilization',
      header: 'Budget Used',
      render: (p: Project) => {
        const pct = p.budgeted_amount > 0 ? (p.total_costs / p.budgeted_amount) * 100 : 0;
        return <span className={pct > 100 ? 'text-destructive font-semibold' : ''}>{pct.toFixed(1)}%</span>;
      },
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Projects"
          description="Manage projects and track costs"
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{activeCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Budget</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Costs</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
              <p className="text-xs text-muted-foreground">
                {totalBudget > 0 ? ((totalCosts / totalBudget) * 100).toFixed(1) : 0}% of budget
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            onRowClick={p => navigate(`/projects/${p.id}`)}
            emptyMessage="No projects found."
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project Code *</Label>
                  <Input value={form.project_code} onChange={e => setForm({ ...form, project_code: e.target.value })} placeholder="PRJ-001" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Budget</Label>
                  <Input type="number" min="0" step="0.01" value={form.budgeted_amount} onChange={e => setForm({ ...form, budgeted_amount: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Project'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, DollarSign, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
}

interface ProjectCost {
  id: string;
  project_id: string;
  cost_type: string;
  description: string;
  amount: number;
  cost_date: string;
  source_module: string | null;
  posted: boolean;
  posted_at: string | null;
  created_at: string;
}

interface ProjectRevenue {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  revenue_date: string;
  posted: boolean;
  created_at: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [revenues, setRevenues] = useState<ProjectRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costForm, setCostForm] = useState({
    cost_type: 'material' as string,
    description: '',
    amount: 0,
    cost_date: new Date().toISOString().split('T')[0],
  });
  const [revForm, setRevForm] = useState({
    description: '',
    amount: 0,
    revenue_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      const [projRes, costsRes, revRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id!).single(),
        supabase.from('project_costs').select('*').eq('project_id', id!).order('cost_date', { ascending: false }),
        supabase.from('project_revenues').select('*').eq('project_id', id!).order('revenue_date', { ascending: false }),
      ]);
      if (projRes.error) throw projRes.error;
      setProject(projRes.data as Project);
      setCosts((costsRes.data || []) as ProjectCost[]);
      setRevenues((revRes.data || []) as ProjectRevenue[]);
    } catch (error) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCost = async () => {
    if (!costForm.description || costForm.amount <= 0) {
      toast.error('Description and amount are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('project_costs').insert({
        project_id: id!,
        cost_type: costForm.cost_type as any,
        description: costForm.description,
        amount: costForm.amount,
        cost_date: costForm.cost_date,
        source_module: 'manual',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Cost added');
      setCostDialogOpen(false);
      setCostForm({ cost_type: 'material', description: '', amount: 0, cost_date: new Date().toISOString().split('T')[0] });
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add cost');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRevenue = async () => {
    if (!revForm.description || revForm.amount <= 0) {
      toast.error('Description and amount are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('project_revenues').insert({
        project_id: id!,
        description: revForm.description,
        amount: revForm.amount,
        revenue_date: revForm.revenue_date,
        source_module: 'manual',
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('Revenue added');
      setRevenueDialogOpen(false);
      setRevForm({ description: '', amount: 0, revenue_date: new Date().toISOString().split('T')[0] });
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add revenue');
    } finally {
      setSaving(false);
    }
  };

  const handlePostCost = async (costId: string) => {
    try {
      const { error } = await supabase.from('project_costs').update({ posted: true }).eq('id', costId);
      if (error) throw error;
      toast.success('Cost posted to GL');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post cost');
    }
  };

  const handlePostRevenue = async (revId: string) => {
    try {
      const { error } = await supabase.from('project_revenues').update({ posted: true }).eq('id', revId);
      if (error) throw error;
      toast.success('Revenue posted');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Failed to post revenue');
    }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64">Loading...</div></AppLayout>;
  if (!project) return <AppLayout><div className="flex items-center justify-center h-64">Project not found</div></AppLayout>;

  const budgetUsed = project.budgeted_amount > 0 ? (project.total_costs / project.budgeted_amount) * 100 : 0;
  const variance = project.budgeted_amount - project.total_costs;

  // Cost breakdown by type
  const costByType = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.cost_type] = (acc[c.cost_type] || 0) + c.amount;
    return acc;
  }, {});

  const costColumns = [
    { key: 'date', header: 'Date', render: (c: ProjectCost) => new Date(c.cost_date).toLocaleDateString() },
    {
      key: 'type', header: 'Type',
      render: (c: ProjectCost) => <Badge variant="outline">{c.cost_type}</Badge>,
    },
    { key: 'description', header: 'Description', render: (c: ProjectCost) => c.description },
    { key: 'amount', header: 'Amount', render: (c: ProjectCost) => formatCurrency(c.amount) },
    {
      key: 'status', header: 'GL Status',
      render: (c: ProjectCost) => c.posted
        ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Posted</Badge>
        : <Button size="sm" variant="outline" onClick={() => handlePostCost(c.id)}>Post to GL</Button>,
    },
  ];

  const revColumns = [
    { key: 'date', header: 'Date', render: (r: ProjectRevenue) => new Date(r.revenue_date).toLocaleDateString() },
    { key: 'description', header: 'Description', render: (r: ProjectRevenue) => r.description },
    { key: 'amount', header: 'Amount', render: (r: ProjectRevenue) => formatCurrency(r.amount) },
    {
      key: 'status', header: 'Status',
      render: (r: ProjectRevenue) => r.posted
        ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Posted</Badge>
        : <Button size="sm" variant="outline" onClick={() => handlePostRevenue(r.id)}>Post</Button>,
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
        </div>

        <PageHeader
          title={`${project.project_code} — ${project.project_name}`}
          description={project.description || `Client: ${project.client_name || 'N/A'}`}
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(project.budgeted_amount)}</div>
              <Progress value={Math.min(budgetUsed, 100)} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{budgetUsed.toFixed(1)}% used</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(project.total_costs)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(project.total_revenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Variance</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${variance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(variance)}
              </div>
              <p className="text-xs text-muted-foreground">{variance >= 0 ? 'Under budget' : 'Over budget'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Cost breakdown */}
        {Object.keys(costByType).length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm font-medium">Cost Breakdown by Type</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-5">
                {Object.entries(costByType).map(([type, amount]) => (
                  <div key={type} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                    <span className="text-sm capitalize">{type}</span>
                    <span className="font-medium text-sm">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="costs">
          <TabsList>
            <TabsTrigger value="costs">Costs ({costs.length})</TabsTrigger>
            <TabsTrigger value="revenue">Revenue ({revenues.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCostDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record Cost
              </Button>
            </div>
            <DataTable columns={costColumns} data={costs} emptyMessage="No costs recorded yet." />
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setRevenueDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Record Revenue
              </Button>
            </div>
            <DataTable columns={revColumns} data={revenues} emptyMessage="No revenue recorded yet." />
          </TabsContent>
        </Tabs>

        {/* Cost Dialog */}
        <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Project Cost</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost Type *</Label>
                  <Select value={costForm.cost_type} onValueChange={v => setCostForm({ ...costForm, cost_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="subcontract">Subcontract</SelectItem>
                      <SelectItem value="overhead">Overhead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={costForm.cost_date} onChange={e => setCostForm({ ...costForm, cost_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input value={costForm.description} onChange={e => setCostForm({ ...costForm, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" min="0.01" step="0.01" value={costForm.amount} onChange={e => setCostForm({ ...costForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCostDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddCost} disabled={saving}>{saving ? 'Saving...' : 'Add Cost'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revenue Dialog */}
        <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Project Revenue</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={revForm.revenue_date} onChange={e => setRevForm({ ...revForm, revenue_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input value={revForm.description} onChange={e => setRevForm({ ...revForm, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" min="0.01" step="0.01" value={revForm.amount} onChange={e => setRevForm({ ...revForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevenueDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRevenue} disabled={saving}>{saving ? 'Saving...' : 'Add Revenue'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

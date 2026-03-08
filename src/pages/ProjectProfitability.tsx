import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
  client_name: string | null;
  budgeted_amount: number;
  total_costs: number;
  total_revenue: number;
  profit_margin: number;
}

export default function ProjectProfitability() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .in('status', ['active', 'completed'])
          .order('project_code');
        if (error) throw error;
        setProjects((data || []) as Project[]);
      } catch { toast.error('Failed to load projects'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const filtered = projects.filter(p =>
    p.project_name.toLowerCase().includes(search.toLowerCase()) ||
    p.project_code.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = projects.reduce((s, p) => s + p.total_revenue, 0);
  const totalCosts = projects.reduce((s, p) => s + p.total_costs, 0);
  const totalProfit = totalRevenue - totalCosts;
  const overBudgetCount = projects.filter(p => p.total_costs > p.budgeted_amount).length;

  const columns = [
    {
      key: 'project', header: 'Project',
      render: (p: Project) => (
        <div>
          <p className="font-medium">{p.project_name}</p>
          <p className="text-xs text-muted-foreground">{p.project_code} • {p.client_name || 'No client'}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (p: Project) => (
        <Badge variant="outline" className={p.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-primary/10 text-primary'}>
          {p.status}
        </Badge>
      ),
    },
    { key: 'budget', header: 'Budget', render: (p: Project) => formatCurrency(p.budgeted_amount) },
    { key: 'costs', header: 'Costs', render: (p: Project) => formatCurrency(p.total_costs) },
    { key: 'revenue', header: 'Revenue', render: (p: Project) => formatCurrency(p.total_revenue) },
    {
      key: 'profit', header: 'Profit/Loss',
      render: (p: Project) => {
        const pl = p.total_revenue - p.total_costs;
        return <span className={pl >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>{formatCurrency(pl)}</span>;
      },
    },
    {
      key: 'margin', header: 'Margin',
      render: (p: Project) => (
        <span className={p.profit_margin >= 0 ? 'text-green-600' : 'text-destructive'}>
          {p.profit_margin.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'variance', header: 'Budget Var.',
      render: (p: Project) => {
        const v = p.budgeted_amount - p.total_costs;
        return (
          <span className={v >= 0 ? 'text-green-600' : 'text-destructive'}>
            {formatCurrency(v)}
          </span>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Project Profitability" description="Variance analysis and profit tracking across projects" />

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Costs</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(totalProfit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Over Budget</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{overBudgetCount}</div><p className="text-xs text-muted-foreground">projects</p></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage="No active/completed projects found." />
        </div>
      </div>
    </AppLayout>
  );
}

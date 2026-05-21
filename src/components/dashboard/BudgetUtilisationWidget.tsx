import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowRight, PiggyBank } from 'lucide-react';

export function BudgetUtilisationWidget() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<{ name: string; pct: number; budget: number; used: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const year = new Date().getFullYear();
        const { data: budgets } = await supabase
          .from('budgets').select('id').eq('fiscal_year', year).eq('status', 'active');
        const ids = (budgets || []).map((b: any) => b.id);
        if (!ids.length) { setRows([]); return; }
        const { data: lines } = await supabase
          .from('budget_lines')
          .select('annual_amount, committed_amount, actual_amount, department:departments(name)')
          .in('budget_id', ids);
        const map: Record<string, { budget: number; used: number }> = {};
        (lines || []).forEach((l: any) => {
          const name = l.department?.name || 'Unassigned';
          if (!map[name]) map[name] = { budget: 0, used: 0 };
          map[name].budget += Number(l.annual_amount || 0);
          map[name].used += Number(l.committed_amount || 0) + Number(l.actual_amount || 0);
        });
        const sorted = Object.entries(map)
          .map(([name, v]) => ({ name, ...v, pct: v.budget > 0 ? (v.used / v.budget) * 100 : 0 }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 5);
        setRows(sorted);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Top Departments by Budget Usage</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/budgets')}>View Budgets <ArrowRight className="ml-1 h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const colorClass = r.pct > 90 ? '[&>div]:bg-destructive' : r.pct >= 70 ? '[&>div]:bg-warning' : '[&>div]:bg-success';
          return (
            <div key={r.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{r.name}</span>
                <span className={r.pct > 90 ? 'text-destructive font-semibold' : r.pct >= 70 ? 'text-warning' : 'text-muted-foreground'}>
                  {r.pct.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(r.pct, 100)} className={`h-2 ${colorClass}`} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/ui/metric-card';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';

interface ForecastWeek {
  week: string;
  startDate: string;
  inflows: number;
  outflows: number;
  net: number;
  runningBalance: number;
}

export default function CashFlowForecast() {
  const [forecast, setForecast] = useState<ForecastWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState(0);

  useEffect(() => { buildForecast(); }, []);

  const buildForecast = async () => {
    // Get current total bank balance
    const { data: banks } = await supabase.from('bank_accounts')
      .select('current_balance').eq('is_active', true);
    const totalBalance = (banks || []).reduce((s: number, b: any) => s + (b.current_balance || 0), 0);
    setCurrentBalance(totalBalance);

    const today = new Date();
    const forecastEnd = new Date(today);
    forecastEnd.setDate(forecastEnd.getDate() + 84); // 12 weeks

    // Get AR invoices due (inflows)
    const { data: arInvoices } = await supabase.from('ar_invoices')
      .select('due_date, total_amount, payment_status')
      .eq('status', 'posted')
      .in('payment_status', ['unpaid', 'partial'])
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', forecastEnd.toISOString().split('T')[0]);

    // Get AP invoices due (outflows)
    const { data: apInvoices } = await supabase.from('ap_invoices')
      .select('due_date, total_amount, payment_status')
      .eq('status', 'posted')
      .in('payment_status', ['unpaid', 'partial'])
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', forecastEnd.toISOString().split('T')[0]);

    // Build weekly buckets
    const weeks: ForecastWeek[] = [];
    let running = totalBalance;

    for (let w = 0; w < 12; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + (w * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const inflows = (arInvoices || [])
        .filter((inv: any) => inv.due_date >= weekStartStr && inv.due_date <= weekEndStr)
        .reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0);

      const outflows = (apInvoices || [])
        .filter((inv: any) => inv.due_date >= weekStartStr && inv.due_date <= weekEndStr)
        .reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0);

      const net = inflows - outflows;
      running += net;

      weeks.push({
        week: `W${w + 1}`,
        startDate: weekStartStr,
        inflows,
        outflows,
        net,
        runningBalance: running,
      });
    }

    setForecast(weeks);
    setLoading(false);
  };

  const totalInflows = forecast.reduce((s, w) => s + w.inflows, 0);
  const totalOutflows = forecast.reduce((s, w) => s + w.outflows, 0);
  const projectedBalance = forecast.length > 0 ? forecast[forecast.length - 1].runningBalance : currentBalance;

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Cash Flow Forecast" description="12-week cash position projection based on AP/AR due dates" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Current Cash" value={formatCurrency(currentBalance)} icon={Wallet} />
          <MetricCard title="Expected Inflows" value={formatCurrency(totalInflows)} icon={TrendingUp} />
          <MetricCard title="Expected Outflows" value={formatCurrency(totalOutflows)} icon={TrendingDown} />
          <MetricCard title="Projected Balance" value={formatCurrency(projectedBalance)} icon={DollarSign} />
        </div>

        {loading ? (
          <Skeleton className="h-80" />
        ) : (
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm">Cash Flow Projection</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelFormatter={(label: string) => {
                      const week = forecast.find(w => w.week === label);
                      return week ? `${label} (${week.startDate})` : label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="inflows" name="Inflows" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflows" name="Outflows" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="runningBalance" name="Running Balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Week</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Start Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Inflows (AR)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Outflows (AP)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Net</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {forecast.map(w => (
                  <tr key={w.week} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5 text-sm font-medium">{w.week}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{w.startDate}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-success">{w.inflows > 0 ? formatCurrency(w.inflows) : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-destructive">{w.outflows > 0 ? formatCurrency(w.outflows) : '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-medium">
                      <span className={w.net >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(w.net)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right font-semibold">
                      <span className={w.runningBalance >= 0 ? '' : 'text-destructive'}>{formatCurrency(w.runningBalance)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

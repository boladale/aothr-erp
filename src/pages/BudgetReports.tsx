import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';

export default function BudgetReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  const { data: budgets = [] } = useQuery({
    queryKey: ['report-budgets'],
    queryFn: async () => {
      const { data } = await supabase.from('budgets').select('id, fiscal_year').order('fiscal_year', { ascending: false });
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['budget-report', year],
    queryFn: async () => {
      const budgetIds = budgets.filter((b: any) => b.fiscal_year === year).map((b: any) => b.id);
      if (!budgetIds.length) return [];
      const { data, error } = await supabase
        .from('budget_lines')
        .select('annual_amount, committed_amount, actual_amount, department:departments(id, name)')
        .in('budget_id', budgetIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((l: any) => {
        const name = l.department?.name || 'Unassigned';
        if (!map[name]) map[name] = { department: name, budget: 0, committed: 0, actual: 0 };
        map[name].budget += Number(l.annual_amount || 0);
        map[name].committed += Number(l.committed_amount || 0);
        map[name].actual += Number(l.actual_amount || 0);
      });
      return Object.values(map).map((r: any) => ({
        ...r,
        variance: r.budget - r.committed - r.actual,
        variancePct: r.budget > 0 ? ((r.budget - r.committed - r.actual) / r.budget) * 100 : 0,
      }));
    },
    enabled: budgets.length > 0,
  });

  const totals = useMemo(() => rows.reduce(
    (acc: any, r: any) => ({
      budget: acc.budget + r.budget, committed: acc.committed + r.committed,
      actual: acc.actual + r.actual, variance: acc.variance + r.variance,
    }),
    { budget: 0, committed: 0, actual: 0, variance: 0 }
  ), [rows]);

  const years = Array.from(new Set(budgets.map((b: any) => b.fiscal_year))).sort((a: any, b: any) => b - a);

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(rows.map((r: any) => ({
      Department: r.department, Budget: r.budget, Committed: r.committed,
      Actual: r.actual, Variance: r.variance, 'Variance %': r.variancePct.toFixed(2),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, `Budget FY${year}`);
    XLSX.writeFile(wb, `budget-report-${year}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader
          title="Budget Reports"
          description="Department-level budget utilisation rollup."
          actions={
            <div className="flex gap-2">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(years.length ? years : [currentYear]).map((y: any) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportExcel} disabled={!rows.length}>
                <Download className="mr-2 h-4 w-4" /> Export Excel
              </Button>
            </div>
          }
        />

        <Card>
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-40" /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No budget data for {year}.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Total Budget</TableHead>
                  <TableHead className="text-right">Total Committed</TableHead>
                  <TableHead className="text-right">Total Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Variance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.department}>
                    <TableCell className="font-medium">{r.department}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.budget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.committed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.actual)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.variance)}</TableCell>
                    <TableCell className="text-right">{r.variancePct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.budget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.committed)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.actual)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.variance)}</TableCell>
                  <TableCell className="text-right">
                    {totals.budget > 0 ? ((totals.variance / totals.budget) * 100).toFixed(1) : '0.0'}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

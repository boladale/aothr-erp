import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { MetricCard } from '@/components/ui/metric-card';
import { DollarSign, Clock, AlertTriangle, Users } from 'lucide-react';

interface AgingRow {
  customer_name: string;
  customer_code: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  total: number;
}

export default function ARAging() {
  const [agingData, setAgingData] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAging(); }, []);

  const fetchAging = async () => {
    // Get all posted, unpaid/partial invoices with customer info
    const { data: invoices, error } = await supabase
      .from('ar_invoices')
      .select('id, customer_id, invoice_number, invoice_date, due_date, total_amount, payment_status, customers(name, code)')
      .eq('status', 'posted')
      .in('payment_status', ['unpaid', 'partial']);

    if (error) { toast.error('Failed to load aging data'); setLoading(false); return; }

    // Get all receipt allocations for these invoices
    const invoiceIds = (invoices || []).map(i => i.id);
    let allocMap: Record<string, number> = {};
    
    if (invoiceIds.length > 0) {
      const { data: allocs } = await supabase
        .from('ar_receipt_allocations')
        .select('invoice_id, allocated_amount, ar_receipts!inner(status)')
        .in('invoice_id', invoiceIds);

      (allocs || []).forEach((a: any) => {
        if (a.ar_receipts?.status === 'posted') {
          allocMap[a.invoice_id] = (allocMap[a.invoice_id] || 0) + (a.allocated_amount || 0);
        }
      });
    }

    const today = new Date();
    const customerMap = new Map<string, AgingRow>();

    (invoices || []).forEach((inv: any) => {
      const outstanding = (inv.total_amount || 0) - (allocMap[inv.id] || 0);
      if (outstanding <= 0) return;

      const dueDate = new Date(inv.due_date || inv.invoice_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const key = inv.customer_id;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customer_name: inv.customers?.name || 'Unknown',
          customer_code: inv.customers?.code || '',
          current: 0, days30: 0, days60: 0, days90: 0, total: 0,
        });
      }

      const row = customerMap.get(key)!;
      if (daysOverdue <= 0) row.current += outstanding;
      else if (daysOverdue <= 30) row.days30 += outstanding;
      else if (daysOverdue <= 60) row.days60 += outstanding;
      else row.days90 += outstanding;
      row.total += outstanding;
    });

    setAgingData(Array.from(customerMap.values()).sort((a, b) => b.total - a.total));
    setLoading(false);
  };

  const totals = agingData.reduce((acc, r) => ({
    current: acc.current + r.current,
    days30: acc.days30 + r.days30,
    days60: acc.days60 + r.days60,
    days90: acc.days90 + r.days90,
    total: acc.total + r.total,
  }), { current: 0, days30: 0, days60: 0, days90: 0, total: 0 });

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AR Aging Report" description="Outstanding receivables by customer aging" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Total Outstanding" value={formatCurrency(totals.total)} icon={DollarSign} />
          <MetricCard title="Current" value={formatCurrency(totals.current)} icon={Clock} />
          <MetricCard title="Overdue (1-60 days)" value={formatCurrency(totals.days30 + totals.days60)} icon={AlertTriangle} />
          <MetricCard title="Overdue (60+ days)" value={formatCurrency(totals.days90)} icon={Users} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Current</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">1-30 Days</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">31-60 Days</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">60+ Days</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agingData.map(row => (
                    <tr key={row.customer_code} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{row.customer_code}</span>
                        {row.customer_name}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(row.current)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(row.days30)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(row.days60)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium text-destructive">{row.days90 > 0 ? formatCurrency(row.days90) : '—'}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                  {agingData.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No outstanding receivables</td></tr>
                  )}
                  {agingData.length > 0 && (
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-4 py-3 text-sm">Total</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(totals.current)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(totals.days30)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(totals.days60)}</td>
                      <td className="px-4 py-3 text-sm text-right text-destructive">{formatCurrency(totals.days90)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(totals.total)}</td>
                    </tr>
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

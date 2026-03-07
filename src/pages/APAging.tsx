import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';

interface AgingRow {
  vendor_name: string;
  vendor_code: string;
  current: number;
  days_30: number;
  days_60: number;
  days_90_plus: number;
  total: number;
}

export default function APAging() {
  const [loading, setLoading] = useState(true);
  const [agingData, setAgingData] = useState<AgingRow[]>([]);
  const [totals, setTotals] = useState({ current: 0, days_30: 0, days_60: 0, days_90_plus: 0, total: 0 });

  useEffect(() => { fetchAging(); }, []);

  const fetchAging = async () => {
    setLoading(true);

    // Get all posted invoices that are not fully paid
    const { data: invoices } = await supabase
      .from('ap_invoices')
      .select('id, invoice_number, invoice_date, due_date, total_amount, payment_status, vendor_id, vendor:vendors(name, code)')
      .eq('status', 'posted')
      .in('payment_status', ['unpaid', 'partial']);

    if (!invoices || invoices.length === 0) {
      setAgingData([]);
      setLoading(false);
      return;
    }

    // Get payment allocations for these invoices
    const invoiceIds = invoices.map(i => i.id);
    const { data: allocs } = await supabase
      .from('ap_payment_allocations')
      .select('invoice_id, allocated_amount, payment:ap_payments(status)')
      .in('invoice_id', invoiceIds);

    // Calculate paid amounts per invoice
    const paidMap: Record<string, number> = {};
    (allocs || []).forEach((a: any) => {
      if (a.payment?.status === 'posted') {
        paidMap[a.invoice_id] = (paidMap[a.invoice_id] || 0) + a.allocated_amount;
      }
    });

    const today = new Date();
    const vendorBuckets: Record<string, AgingRow> = {};

    invoices.forEach((inv: any) => {
      const vendor = inv.vendor as any;
      const key = inv.vendor_id;
      if (!vendorBuckets[key]) {
        vendorBuckets[key] = {
          vendor_name: vendor?.name || 'Unknown',
          vendor_code: vendor?.code || '',
          current: 0, days_30: 0, days_60: 0, days_90_plus: 0, total: 0,
        };
      }

      const outstanding = (inv.total_amount || 0) - (paidMap[inv.id] || 0);
      if (outstanding <= 0) return;

      const dueDate = new Date(inv.due_date || inv.invoice_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) vendorBuckets[key].current += outstanding;
      else if (daysOverdue <= 30) vendorBuckets[key].days_30 += outstanding;
      else if (daysOverdue <= 60) vendorBuckets[key].days_60 += outstanding;
      else vendorBuckets[key].days_90_plus += outstanding;

      vendorBuckets[key].total += outstanding;
    });

    const rows = Object.values(vendorBuckets).sort((a, b) => b.total - a.total);

    setTotals({
      current: rows.reduce((s, r) => s + r.current, 0),
      days_30: rows.reduce((s, r) => s + r.days_30, 0),
      days_60: rows.reduce((s, r) => s + r.days_60, 0),
      days_90_plus: rows.reduce((s, r) => s + r.days_90_plus, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
    });

    setAgingData(rows);
    setLoading(false);
  };

  const columns = [
    { header: 'Vendor', accessorKey: 'vendor_name', cell: ({ row }: any) => (
      <div>
        <p className="font-medium">{row.original.vendor_name}</p>
        <p className="text-xs text-muted-foreground">{row.original.vendor_code}</p>
      </div>
    )},
    { header: 'Current', accessorKey: 'current', cell: ({ row }: any) => formatCurrency(row.original.current) },
    { header: '1-30 Days', accessorKey: 'days_30', cell: ({ row }: any) => <span className={row.original.days_30 > 0 ? 'text-warning font-medium' : ''}>{formatCurrency(row.original.days_30)}</span> },
    { header: '31-60 Days', accessorKey: 'days_60', cell: ({ row }: any) => <span className={row.original.days_60 > 0 ? 'text-orange-500 font-medium' : ''}>{formatCurrency(row.original.days_60)}</span> },
    { header: '90+ Days', accessorKey: 'days_90_plus', cell: ({ row }: any) => <span className={row.original.days_90_plus > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(row.original.days_90_plus)}</span> },
    { header: 'Total', accessorKey: 'total', cell: ({ row }: any) => <span className="font-semibold">{formatCurrency(row.original.total)}</span> },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="AP Aging Report" description="Outstanding payables by aging bucket." />

        {/* Summary cards */}
        <div className="card-grid mb-6">
          {[
            { label: 'Current', value: totals.current, color: 'text-foreground' },
            { label: '1-30 Days', value: totals.days_30, color: 'text-warning' },
            { label: '31-60 Days', value: totals.days_60, color: 'text-orange-500' },
            { label: '90+ Days', value: totals.days_90_plus, color: 'text-destructive' },
          ].map(b => (
            <Card key={b.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{b.label}</p>
                <p className={`text-xl font-bold ${b.color}`}>{formatCurrency(b.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <Skeleton className="h-64" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aging by Vendor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable columns={columns} data={agingData} />
            </CardContent>
            {agingData.length > 0 && (
              <div className="border-t p-4 flex justify-between text-sm font-semibold">
                <span>Total Outstanding</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

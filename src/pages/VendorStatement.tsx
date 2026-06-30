import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { FileSpreadsheet, FileText, CreditCard } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Row {
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;   // payment (reduces what we owe)
  credit: number;  // invoice (increases what we owe)
  balance: number;
  status?: string;
}

export default function VendorStatement() {
  const [vendorId, setVendorId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const vendorsQ = useQuery({
    queryKey: ['vendors-active-stmt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
  const vendors = vendorsQ.data || [];
  const vendor = vendors.find(v => v.id === vendorId);

  const statementQ = useQuery({
    queryKey: ['vendor-statement', vendorId, fromDate, toDate],
    enabled: !!vendorId,
    queryFn: async () => {
      let invQ = supabase
        .from('ap_invoices')
        .select('id, invoice_number, invoice_date, total_amount, status, payment_status, description')
        .eq('vendor_id', vendorId)
        .in('status', ['posted']);
      if (fromDate) invQ = invQ.gte('invoice_date', fromDate);
      if (toDate) invQ = invQ.lte('invoice_date', toDate);
      const { data: invs, error: invErr } = await invQ;
      if (invErr) throw invErr;

      let payQ = supabase
        .from('ap_payments')
        .select('id, payment_number, payment_date, total_amount, status, payment_method, reference_number, notes')
        .eq('vendor_id', vendorId)
        .eq('status', 'posted');
      if (fromDate) payQ = payQ.gte('payment_date', fromDate);
      if (toDate) payQ = payQ.lte('payment_date', toDate);
      const { data: pays, error: payErr } = await payQ;
      if (payErr) throw payErr;

      const events: Omit<Row, 'balance'>[] = [];
      (invs || []).forEach((i: any) => events.push({
        date: i.invoice_date,
        type: 'invoice',
        reference: i.invoice_number,
        description: i.description || 'Vendor invoice',
        credit: Number(i.total_amount || 0),
        debit: 0,
        status: i.payment_status,
      }));
      (pays || []).forEach((p: any) => events.push({
        date: p.payment_date,
        type: 'payment',
        reference: p.payment_number,
        description: `${(p.payment_method || '').replace('_', ' ')}${p.reference_number ? ` • Ref: ${p.reference_number}` : ''}`,
        credit: 0,
        debit: Number(p.total_amount || 0),
        status: p.status,
      }));

      events.sort((a, b) => {
        if (a.date === b.date) return a.type === 'invoice' ? -1 : 1;
        return a.date < b.date ? -1 : 1;
      });

      let bal = 0;
      const rows: Row[] = events.map(e => {
        bal += e.credit - e.debit;
        return { ...e, balance: bal };
      });
      return rows;
    },
  });

  const rows = statementQ.data || [];
  const totals = useMemo(() => ({
    invoiced: rows.reduce((s, r) => s + r.credit, 0),
    paid: rows.reduce((s, r) => s + r.debit, 0),
    balance: rows.length ? rows[rows.length - 1].balance : 0,
  }), [rows]);

  const exportExcel = () => {
    if (!vendor || rows.length === 0) return;
    const wsData = [
      ['Vendor Statement'],
      ['Vendor', `${vendor.name} (${vendor.code})`],
      ['Period', `${fromDate || 'All'} to ${toDate || 'Today'}`],
      [],
      ['Date', 'Type', 'Reference', 'Description', 'Invoiced', 'Paid', 'Balance', 'Status'],
      ...rows.map(r => [r.date, r.type, r.reference, r.description, r.credit, r.debit, r.balance, r.status || '']),
      [],
      ['', '', '', 'Totals', totals.invoiced, totals.paid, totals.balance, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    XLSX.writeFile(wb, `vendor-statement-${vendor.code}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <AppLayout>
      <div className="page-container space-y-4">
        <PageHeader
          title="Vendor Statement"
          description="All invoices and payments for a vendor with running balance."
          actions={
            <Button variant="outline" onClick={exportExcel} disabled={!vendor || rows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
            </Button>
          }
        />

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); }}>Clear dates</Button>
            </div>
          </CardContent>
        </Card>

        {vendor && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.invoiced)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.paid)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className={`text-2xl font-bold ${totals.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                {formatCurrency(totals.balance)}
              </p>
            </CardContent></Card>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {!vendorId ? (
              <p className="p-8 text-center text-muted-foreground">Select a vendor to view its statement.</p>
            ) : statementQ.isLoading ? (
              <p className="p-8 text-center text-muted-foreground">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No posted invoices or payments for this vendor in the selected period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        {r.type === 'invoice' ? (
                          <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Invoice</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><CreditCard className="h-3 w-3" /> Payment</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.reference}</TableCell>
                      <TableCell className="text-muted-foreground">{r.description}</TableCell>
                      <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : '-'}</TableCell>
                      <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : '-'}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.balance > 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(r.balance)}
                      </TableCell>
                      <TableCell><span className="text-xs capitalize">{r.status?.replace('_', ' ')}</span></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4} className="text-right">Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.invoiced)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.paid)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.balance)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

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
import { formatCurrency } from '@/lib/currency';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { exportToXLSX, printReport } from '@/lib/export-utils';
import { useOrgBranding } from '@/hooks/useOrgBranding';

interface Row {
  date: string;
  reference: string;
  description: string;
  payee: string;
  type: string;
  debit: number;   // money in
  credit: number;  // money out
  balance: number;
  status: string;
}

// deposit/credit types increase bank balance; withdrawals/debits decrease it
const CREDIT_TYPES = new Set(['deposit', 'credit', 'transfer_in', 'interest', 'receipt']);

export default function BankStatement() {
  const [accountId, setAccountId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const { branding } = useOrgBranding();

  const accountsQ = useQuery({
    queryKey: ['bank-accounts-stmt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, account_name, account_number, bank_name, currency, opening_balance, current_balance')
        .eq('is_active', true)
        .order('account_name');
      if (error) throw error;
      return data || [];
    },
  });
  const accounts = accountsQ.data || [];
  const account = accounts.find(a => a.id === accountId);

  const stmtQ = useQuery({
    queryKey: ['bank-statement', accountId, fromDate, toDate],
    enabled: !!accountId,
    queryFn: async () => {
      // opening balance = account.opening_balance + sum of posted txns BEFORE fromDate
      let openingBal = Number(account?.opening_balance || 0);
      if (fromDate) {
        const { data: prior } = await supabase
          .from('bank_transactions')
          .select('transaction_type, amount, status')
          .eq('bank_account_id', accountId)
          .eq('status', 'posted')
          .lt('transaction_date', fromDate);
        (prior || []).forEach((t: any) => {
          const amt = Number(t.amount || 0);
          openingBal += CREDIT_TYPES.has(t.transaction_type) ? amt : -amt;
        });
      }

      let q = supabase
        .from('bank_transactions')
        .select('id, transaction_date, transaction_type, amount, description, reference, payee, status')
        .eq('bank_account_id', accountId)
        .eq('status', 'posted')
        .order('transaction_date', { ascending: true });
      if (fromDate) q = q.gte('transaction_date', fromDate);
      if (toDate) q = q.lte('transaction_date', toDate);
      const { data, error } = await q;
      if (error) throw error;

      let bal = openingBal;
      const rows: Row[] = (data || []).map((t: any) => {
        const amt = Number(t.amount || 0);
        const isCredit = CREDIT_TYPES.has(t.transaction_type);
        const debit = isCredit ? amt : 0;
        const credit = isCredit ? 0 : amt;
        bal += debit - credit;
        return {
          date: t.transaction_date,
          reference: t.reference || '-',
          description: t.description || '-',
          payee: t.payee || '-',
          type: (t.transaction_type || '').replace('_', ' '),
          debit,
          credit,
          balance: bal,
          status: t.status,
        };
      });
      return { openingBal, rows };
    },
  });

  const openingBal = stmtQ.data?.openingBal || 0;
  const rows = stmtQ.data?.rows || [];
  const totals = useMemo(() => ({
    debit: rows.reduce((s, r) => s + r.debit, 0),
    credit: rows.reduce((s, r) => s + r.credit, 0),
    closing: rows.length ? rows[rows.length - 1].balance : openingBal,
  }), [rows, openingBal]);

  const filename = () => {
    const acc = account ? `${account.account_name}`.replace(/\s+/g, '-') : 'account';
    return `bank-statement-${acc}-${new Date().toISOString().split('T')[0]}`;
  };

  const exportExcel = () => {
    if (!account) return;
    const data = [
      { Date: '', Reference: '', Description: 'Opening Balance', Payee: '', Type: '', 'Money In': '', 'Money Out': '', Balance: openingBal },
      ...rows.map(r => ({
        Date: r.date,
        Reference: r.reference,
        Description: r.description,
        Payee: r.payee,
        Type: r.type,
        'Money In': r.debit || '',
        'Money Out': r.credit || '',
        Balance: r.balance,
      })),
      { Date: '', Reference: '', Description: 'Totals / Closing', Payee: '', Type: '', 'Money In': totals.debit, 'Money Out': totals.credit, Balance: totals.closing },
    ];
    exportToXLSX(data, filename(), 'Bank Statement');
  };

  const exportPDF = () => {
    if (!account) return;
    const headers = ['Date', 'Reference', 'Description', 'Payee', 'Type', 'Money In', 'Money Out', 'Balance'];
    const body: string[][] = [
      ['', '', 'Opening Balance', '', '', '', '', formatCurrency(openingBal)],
      ...rows.map(r => [
        r.date, r.reference, r.description, r.payee, r.type,
        r.debit ? formatCurrency(r.debit) : '',
        r.credit ? formatCurrency(r.credit) : '',
        formatCurrency(r.balance),
      ]),
      ['', '', 'Totals / Closing Balance', '', '', formatCurrency(totals.debit), formatCurrency(totals.credit), formatCurrency(totals.closing)],
    ];
    const subtitle = `Account: ${account.account_name} • ${account.bank_name || ''} • ${account.account_number || ''} • Period: ${fromDate || 'Opening'} → ${toDate || 'Today'}`;
    printReport('Bank Statement', headers, body, {
      subtitle,
      orgName: branding?.name,
      logoUrl: branding?.logoUrl,
    });
  };

  return (
    <AppLayout>
      <div className="page-container space-y-4">
        <PageHeader
          title="Bank Statement"
          description="Transaction history and running balance for a bank account."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportPDF} disabled={!account}>
                <Printer className="h-4 w-4 mr-2" /> Print / PDF
              </Button>
              <Button variant="outline" onClick={exportExcel} disabled={!account}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
              </Button>
            </div>
          }
        />

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Bank Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} — {a.bank_name} ({a.account_number})
                    </SelectItem>
                  ))}
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

        {account && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(openingBal)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Money In</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.debit)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Money Out</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totals.credit)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.closing)}</p>
            </CardContent></Card>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {!accountId ? (
              <p className="p-8 text-center text-muted-foreground">Select a bank account to view its statement.</p>
            ) : stmtQ.isLoading ? (
              <p className="p-8 text-center text-muted-foreground">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Money In</TableHead>
                    <TableHead className="text-right">Money Out</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={7}>Opening Balance {fromDate ? `(as of ${fromDate})` : ''}</TableCell>
                    <TableCell className="text-right">{formatCurrency(openingBal)}</TableCell>
                  </TableRow>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                        No posted transactions for this account in the selected period.
                      </TableCell>
                    </TableRow>
                  ) : rows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium">{r.reference}</TableCell>
                      <TableCell className="text-muted-foreground">{r.description}</TableCell>
                      <TableCell>{r.payee}</TableCell>
                      <TableCell className="capitalize text-xs">{r.type}</TableCell>
                      <TableCell className="text-right text-green-600">{r.debit ? formatCurrency(r.debit) : '-'}</TableCell>
                      <TableCell className="text-right text-destructive">{r.credit ? formatCurrency(r.credit) : '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={5} className="text-right">Totals / Closing</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.debit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.credit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.closing)}</TableCell>
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

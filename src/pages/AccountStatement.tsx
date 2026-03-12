import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButtons } from '@/components/exports/ExportButtons';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  normal_balance: string;
}

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  journal_entry: {
    entry_number: string;
    entry_date: string;
    description: string | null;
    source_module: string | null;
  };
}

export default function AccountStatement() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchAccountsWithTransactions();
  }, []);

  useEffect(() => {
    if (selectedAccount) fetchStatement();
  }, [selectedAccount, dateFrom, dateTo]);

  const fetchAccountsWithTransactions = async () => {
    // Get distinct account_ids that have journal lines in posted entries
    const { data } = await supabase
      .from('gl_journal_lines')
      .select('account_id, account:gl_accounts(id, account_code, account_name, normal_balance)')
      .not('account_id', 'is', null);

    if (data) {
      const uniqueMap = new Map<string, GLAccount>();
      data.forEach((line: any) => {
        if (line.account && !uniqueMap.has(line.account.id)) {
          uniqueMap.set(line.account.id, line.account);
        }
      });
      const sorted = Array.from(uniqueMap.values()).sort((a, b) =>
        a.account_code.localeCompare(b.account_code)
      );
      setAccounts(sorted);
    }
    setAccountsLoading(false);
  };

  const fetchStatement = async () => {
    setLoading(true);
    let query = supabase
      .from('gl_journal_lines')
      .select('id, debit, credit, description, journal_entry:gl_journal_entries!inner(entry_number, entry_date, description, source_module, status)')
      .eq('account_id', selectedAccount)
      .eq('gl_journal_entries.status', 'posted')
      .order('created_at', { ascending: true });

    if (dateFrom) {
      query = query.gte('gl_journal_entries.entry_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('gl_journal_entries.entry_date', dateTo);
    }

    const { data } = await query;

    // Sort by entry_date then entry_number
    const sorted = (data || []).sort((a: any, b: any) => {
      const dateA = a.journal_entry?.entry_date || '';
      const dateB = b.journal_entry?.entry_date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.journal_entry?.entry_number || '').localeCompare(b.journal_entry?.entry_number || '');
    });

    setLines(sorted as any);
    setLoading(false);
  };

  const selectedAccountInfo = accounts.find(a => a.id === selectedAccount);

  // Compute running balance
  const linesWithBalance = useMemo(() => {
    let runningBalance = 0;
    return lines.map(line => {
      const isDebitNormal = selectedAccountInfo?.normal_balance === 'debit';
      if (isDebitNormal) {
        runningBalance += line.debit - line.credit;
      } else {
        runningBalance += line.credit - line.debit;
      }
      return { ...line, runningBalance };
    });
  }, [lines, selectedAccountInfo]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const closingBalance = linesWithBalance.length > 0 ? linesWithBalance[linesWithBalance.length - 1].runningBalance : 0;

  const exportData = linesWithBalance.map(l => ({
    date: l.journal_entry?.entry_date || '',
    entry_number: l.journal_entry?.entry_number || '',
    description: l.description || l.journal_entry?.description || '',
    source: l.journal_entry?.source_module || '',
    debit: l.debit.toFixed(2),
    credit: l.credit.toFixed(2),
    balance: l.runningBalance.toFixed(2),
  }));

  const exportColumns = [
    { key: 'date', header: 'Date' },
    { key: 'entry_number', header: 'Entry #' },
    { key: 'description', header: 'Description' },
    { key: 'source', header: 'Source' },
    { key: 'debit', header: 'Debit' },
    { key: 'credit', header: 'Credit' },
    { key: 'balance', header: 'Balance' },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Statement of Account"
          description="Detailed transaction listing per GL account with running balance"
        />

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>GL Account</Label>
                {accountsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger><SelectValue placeholder="Select an account..." /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_code} — {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>From Date</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedAccount ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a GL account above to view its statement
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedAccountInfo?.account_code} — {selectedAccountInfo?.account_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Normal balance: {selectedAccountInfo?.normal_balance} · {lines.length} transaction{lines.length !== 1 ? 's' : ''}
                  {dateFrom && ` · From ${dateFrom}`}
                  {dateTo && ` · To ${dateTo}`}
                </p>
              </div>
              <ExportButtons
                data={exportData}
                filename={`statement-${selectedAccountInfo?.account_code}`}
                title={`Statement of Account: ${selectedAccountInfo?.account_code} — ${selectedAccountInfo?.account_name}`}
                subtitle={`${dateFrom ? 'From ' + dateFrom : 'All dates'}${dateTo ? ' to ' + dateTo : ''}`}
                columns={exportColumns}
              />
            </CardHeader>
            <CardContent>
              {lines.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No posted transactions found for this account</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-28">Date</TableHead>
                        <TableHead className="w-36">Entry #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24 text-xs">Source</TableHead>
                        <TableHead className="text-right w-32">Debit</TableHead>
                        <TableHead className="text-right w-32">Credit</TableHead>
                        <TableHead className="text-right w-36">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linesWithBalance.map(line => (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono text-xs">
                            {line.journal_entry?.entry_date
                              ? format(new Date(line.journal_entry.entry_date), 'dd MMM yyyy')
                              : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{line.journal_entry?.entry_number}</TableCell>
                          <TableCell className="text-sm">
                            {line.description || line.journal_entry?.description || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">
                            {line.journal_entry?.source_module?.replace(/_/g, ' ') || 'manual'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                          </TableCell>
                          <TableCell className={cn(
                            'text-right font-mono text-sm font-medium',
                            line.runningBalance < 0 ? 'text-destructive' : ''
                          )}>
                            {formatCurrency(Math.abs(line.runningBalance))}
                            {line.runningBalance < 0 ? ' CR' : ' DR'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="font-semibold">
                        <TableCell colSpan={4} className="text-right">Totals</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
                        <TableCell className={cn(
                          'text-right font-mono font-bold',
                          closingBalance < 0 ? 'text-destructive' : ''
                        )}>
                          {formatCurrency(Math.abs(closingBalance))}
                          {closingBalance < 0 ? ' CR' : ' DR'}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

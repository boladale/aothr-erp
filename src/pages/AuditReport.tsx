import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { Search, FileText } from 'lucide-react';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  source_module: string | null;
  status: string;
  total_debit: number;
  total_credit: number;
  posted_at: string | null;
}

interface JournalLine {
  id: string;
  line_number: number;
  debit: number;
  credit: number;
  description: string | null;
  gl_accounts: { account_code: string; account_name: string; account_type: string } | null;
}

export default function AuditReport() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedEntry(null);
    setLines([]);

    const { data, error } = await supabase
      .from('gl_journal_entries')
      .select('id, entry_number, entry_date, description, source_module, status, total_debit, total_credit, posted_at')
      .ilike('entry_number', `%${searchTerm.trim()}%`)
      .order('entry_date', { ascending: false })
      .limit(50);

    setResults(data || []);
    setLoading(false);

    // Auto-select if single result
    if (data && data.length === 1) {
      loadLines(data[0]);
    }
  };

  const loadLines = async (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setLinesLoading(true);
    const { data } = await supabase
      .from('gl_journal_lines')
      .select('id, line_number, debit, credit, description, gl_accounts(account_code, account_name, account_type)')
      .eq('journal_entry_id', entry.id)
      .order('line_number');
    setLines((data as any) || []);
    setLinesLoading(false);
  };

  const sourceLabels: Record<string, string> = {
    accounts_payable: 'Accounts Payable',
    accounts_receivable: 'Accounts Receivable',
    cash_management: 'Cash Management',
    inventory: 'Inventory',
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Transaction Audit Report" description="Search by transaction number to view all debit/credit entries" />

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Input
                placeholder="Enter transaction number (e.g. PO-00001, PAY-00003, JE-00002)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card className="mt-4">
            <CardContent className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </CardContent>
          </Card>
        )}

        {!loading && searched && results.length === 0 && (
          <Card className="mt-4">
            <CardContent className="py-12 text-center text-muted-foreground">
              No transactions found matching "{searchTerm}"
            </CardContent>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                {results.length} transaction{results.length > 1 ? 's' : ''} found
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Entry #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Credit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map(entry => (
                    <tr
                      key={entry.id}
                      className={`cursor-pointer transition-colors ${selectedEntry?.id === entry.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => loadLines(entry)}
                    >
                      <td className="px-4 py-3 text-sm font-mono font-medium">{entry.entry_number}</td>
                      <td className="px-4 py-3 text-sm">{entry.entry_date}</td>
                      <td className="px-4 py-3 text-sm">{entry.description}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.source_module ? sourceLabels[entry.source_module] || entry.source_module : 'Manual'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(entry.total_debit)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(entry.total_credit)}</td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {selectedEntry && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {selectedEntry.entry_number} — Journal Lines
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedEntry.description}
                {selectedEntry.posted_at && ` • Posted ${new Date(selectedEntry.posted_at).toLocaleString()}`}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {linesLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Account Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Debit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map(line => (
                      <tr key={line.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm text-muted-foreground">{line.line_number}</td>
                        <td className="px-4 py-3 text-sm font-mono">{line.gl_accounts?.account_code || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium">{line.gl_accounts?.account_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{line.gl_accounts?.account_type || '-'}</td>
                        <td className="px-4 py-3 text-sm">{line.description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td colSpan={5} className="px-4 py-3 text-sm text-right">Totals:</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatCurrency(lines.reduce((s, l) => s + l.debit, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatCurrency(lines.reduce((s, l) => s + l.credit, 0))}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="px-4 py-2 text-center">
                        {lines.reduce((s, l) => s + l.debit, 0) === lines.reduce((s, l) => s + l.credit, 0)
                          ? <span className="text-success text-xs font-medium">✓ Balanced</span>
                          : <span className="text-destructive text-xs font-medium">✗ Unbalanced — Difference: {formatCurrency(Math.abs(lines.reduce((s, l) => s + l.debit, 0) - lines.reduce((s, l) => s + l.credit, 0)))}</span>
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

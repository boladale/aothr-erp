import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  reference: string;
  type: 'deposit' | 'withdrawal';
}

interface Props {
  bankAccountId: string;
  bankAccountName: string;
  onImported: () => void;
}

export function BankStatementImport({ bankAccountId, bankAccountName, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dateCol, setDateCol] = useState('0');
  const [descCol, setDescCol] = useState('1');
  const [amountCol, setAmountCol] = useState('2');
  const [refCol, setRefCol] = useState('3');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]); setHeaders([]); setRawData([]); setStep('upload');
    setDateCol('0'); setDescCol('1'); setAmountCol('2'); setRefCol('3');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('File must have header + at least one data row'); return; }

      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const parsed = lines.map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += char; }
        }
        result.push(current.trim());
        return result;
      });

      setHeaders(parsed[0]);
      setRawData(parsed.slice(1));

      // Auto-detect columns
      const h = parsed[0].map(s => s.toLowerCase());
      const dateIdx = h.findIndex(c => c.includes('date'));
      const descIdx = h.findIndex(c => c.includes('desc') || c.includes('narr') || c.includes('detail'));
      const amtIdx = h.findIndex(c => c.includes('amount') || c.includes('debit') || c.includes('credit'));
      const refIdx = h.findIndex(c => c.includes('ref') || c.includes('cheque') || c.includes('check'));

      if (dateIdx >= 0) setDateCol(String(dateIdx));
      if (descIdx >= 0) setDescCol(String(descIdx));
      if (amtIdx >= 0) setAmountCol(String(amtIdx));
      if (refIdx >= 0) setRefCol(String(refIdx));

      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleMap = () => {
    const mapped: ParsedRow[] = rawData.map(row => {
      const rawAmount = parseFloat(row[parseInt(amountCol)]?.replace(/[^-\d.]/g, '') || '0');
      return {
        date: row[parseInt(dateCol)] || '',
        description: row[parseInt(descCol)] || '',
        amount: rawAmount,
        reference: row[parseInt(refCol)] || '',
        type: rawAmount >= 0 ? 'deposit' as const : 'withdrawal' as const,
      };
    }).filter(r => r.date && !isNaN(r.amount));

    if (mapped.length === 0) { toast.error('No valid rows found. Check column mapping.'); return; }
    setRows(mapped);
    setStep('preview');
  };

  const parseDate = (dateStr: string): string => {
    // Try multiple date formats
    const cleaned = dateStr.trim();
    // ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.substring(0, 10);
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // MM/DD/YYYY
    const mdy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
    // Fallback
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    return cleaned;
  };

  const handleImport = async () => {
    setImporting(true);
    const inserts = rows.map(r => ({
      bank_account_id: bankAccountId,
      transaction_date: parseDate(r.date),
      transaction_type: r.amount >= 0 ? 'deposit' : 'withdrawal',
      amount: r.amount,
      description: r.description || null,
      reference: r.reference || null,
      status: 'pending',
    }));

    const { error } = await supabase.from('bank_transactions').insert(inserts as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${rows.length} transactions imported`);
      setOpen(false);
      reset();
      onImported();
    }
    setImporting(false);
  };

  const colOptions = headers.map((h, i) => ({ label: `${i}: ${h}`, value: String(i) }));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(true); }}>
        <Upload className="h-4 w-4 mr-2" /> Import Statement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Bank Statement — {bankAccountName}</DialogTitle>
          </DialogHeader>

          {step === 'upload' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Upload a CSV file with your bank statement</p>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
                <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Select CSV File</Button>
                <Button variant="outline" onClick={() => {
                  const template = 'Date,Description,Amount,Reference\n2025-01-15,Salary Credit,250000.00,SAL-001\n2025-01-16,Office Supplies,-15000.00,PO-1234\n2025-01-17,Client Payment,500000.00,INV-0056\n2025-01-18,Utility Bill,-8500.50,UTIL-JAN\n';
                  const blob = new Blob([template], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'bank_statement_template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-4 w-4 mr-2" /> Download Template
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Required columns: Date, Description, Amount, Reference</p>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Map CSV columns to transaction fields. We auto-detected common column names.</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Date Column', value: dateCol, setter: setDateCol },
                  { label: 'Description Column', value: descCol, setter: setDescCol },
                  { label: 'Amount Column', value: amountCol, setter: setAmountCol },
                  { label: 'Reference Column', value: refCol, setter: setRefCol },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <Label>{label}</Label>
                    <Select value={value} onValueChange={setter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {colOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Preview: {rawData.length} rows detected</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button onClick={handleMap}>Map & Preview</Button>
              </DialogFooter>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{rows.length} transactions ready to import</p>
              <div className="border rounded-md overflow-x-auto max-h-60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-left">Reference</th>
                      <th className="p-2 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{r.date}</td>
                        <td className="p-2 max-w-48 truncate">{r.description}</td>
                        <td className={`p-2 text-right ${r.amount < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {r.amount.toFixed(2)}
                        </td>
                        <td className="p-2">{r.reference}</td>
                        <td className="p-2">{r.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && <p className="text-xs text-muted-foreground">Showing first 50 of {rows.length} rows</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : `Import ${rows.length} Transactions`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

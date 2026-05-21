import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Printer, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrgBranding } from '@/hooks/useOrgBranding';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/currency';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);
const ALLOWED_ROLES = ['admin', 'hr_manager', 'payroll_manager', 'accounts_payable'] as const;

// ---------- Nigerian PAYE 2024 ----------
function computeAnnualPAYE(annualGross: number, annualPension: number, annualNHF: number) {
  const cra = Math.max(200_000, annualGross * 0.01) + annualGross * 0.20;
  const taxable = Math.max(0, annualGross - cra - annualPension - annualNHF);
  const bands = [
    { limit: 300_000, rate: 0.07 },
    { limit: 300_000, rate: 0.11 },
    { limit: 500_000, rate: 0.15 },
    { limit: 500_000, rate: 0.19 },
    { limit: 1_600_000, rate: 0.21 },
    { limit: Infinity, rate: 0.24 },
  ];
  let remaining = taxable;
  let tax = 0;
  for (const b of bands) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, b.limit);
    tax += slice * b.rate;
    remaining -= slice;
  }
  return { tax, taxable, cra };
}

function periodLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

function downloadXLSX(rows: Record<string, any>[], filename: string, header?: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, header ? { header } : undefined);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function PrintExportBar({ onPrint, onExport, disabled }: { onPrint: () => void; onExport: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2 no-print">
      <Button variant="outline" size="sm" onClick={onPrint} disabled={disabled}>
        <Printer className="h-3 w-3 mr-1" /> Print
      </Button>
      <Button variant="outline" size="sm" onClick={onExport} disabled={disabled}>
        <FileSpreadsheet className="h-3 w-3 mr-1" /> Export Excel
      </Button>
    </div>
  );
}

function EmptyState({ msg = 'No data found for the selected period.' }: { msg?: string }) {
  return <div className="text-center py-12 text-sm text-muted-foreground">{msg}</div>;
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

// =========================================================
// TAB 1 — PAYE
// =========================================================
function PAYETab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [trigger, setTrigger] = useState(0);

  const { data: departments } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').eq('organization_id', orgId);
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['paye', orgId, month, year, departmentId, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      const { data: runs } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('organization_id', orgId)
        .eq('period_month', month)
        .eq('period_year', year);
      const runIds = (runs || []).map((r: any) => r.id);
      if (runIds.length === 0) return [];

      const { data: lines } = await supabase
        .from('payroll_lines')
        .select('id, employee_id, gross_salary, pension_employee, tax_amount, net_salary')
        .in('payroll_run_id', runIds);

      const employeeIds = Array.from(new Set((lines || []).map((l: any) => l.employee_id)));
      const { data: employees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_number, department_id, tax_id')
        .in('id', employeeIds);

      const empMap = new Map((employees || []).map((e: any) => [e.id, e]));
      const filtered = (lines || []).filter((l: any) => {
        const emp = empMap.get(l.employee_id);
        if (!emp) return false;
        if (departmentId !== 'all' && emp.department_id !== departmentId) return false;
        return true;
      });

      return filtered.map((l: any) => {
        const emp = empMap.get(l.employee_id);
        const gross = Number(l.gross_salary || 0);
        const pension = Number(l.pension_employee || gross * 0.08);
        const nhf = gross * 0.025;
        const annualPAYE = computeAnnualPAYE(gross * 12, pension * 12, nhf * 12);
        const paye = annualPAYE.tax / 12;
        return {
          name: `${emp.first_name} ${emp.last_name}`,
          staffId: emp.employee_number || '',
          tin: emp.tax_id || '',
          gross,
          pension,
          nhf,
          taxable: annualPAYE.taxable / 12,
          paye,
          net: gross - pension - nhf - paye,
        };
      });
    },
  });

  const totals = useMemo(() => {
    const rows = data || [];
    return rows.reduce((a, r) => ({
      gross: a.gross + r.gross,
      pension: a.pension + r.pension,
      nhf: a.nhf + r.nhf,
      paye: a.paye + r.paye,
      net: a.net + r.net,
    }), { gross: 0, pension: 0, nhf: 0, paye: 0, net: 0 });
  }, [data]);

  const handleExport = () => {
    const rows = (data || []).map(r => ({
      'Employee Name': r.name,
      'Staff ID': r.staffId,
      'TIN': r.tin,
      'Gross Pay (NGN)': r.gross.toFixed(2),
      'Pension 8% (NGN)': r.pension.toFixed(2),
      'NHF 2.5% (NGN)': r.nhf.toFixed(2),
      'Taxable Income (NGN)': r.taxable.toFixed(2),
      'PAYE (NGN)': r.paye.toFixed(2),
      'Net Pay (NGN)': r.net.toFixed(2),
    }));
    rows.unshift({ 'Employee Name': `Company: ${orgName} | Period: ${periodLabel(month, year)}`, 'Staff ID': '', 'TIN': '', 'Gross Pay (NGN)': '', 'Pension 8% (NGN)': '', 'NHF 2.5% (NGN)': '', 'Taxable Income (NGN)': '', 'PAYE (NGN)': '', 'Net Pay (NGN)': '' } as any);
    downloadXLSX(rows, `PAYE_${orgName}_${year}_${String(month).padStart(2,'0')}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PAYE Report — {periodLabel(month, year)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 no-print">
          <div>
            <Label>Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(departments || []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>
          <div className="flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={!data || data.length === 0} />
          </div>
        </div>

        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — PAYE Report</h2>
            <p className="text-sm">Period: {periodLabel(month, year)}</p>
          </div>
          {isLoading ? <LoadingRows /> : !data || data.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Pension 8%</TableHead>
                  <TableHead className="text-right">NHF 2.5%</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.staffId}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.pension)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.nhf)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.taxable)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.paye)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.gross)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.pension)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.nhf)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.paye)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.net)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// TAB 2 — Pension Remittance
// =========================================================
function PensionTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trigger, setTrigger] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['pension', orgId, month, year, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      const { data: runs } = await supabase.from('payroll_runs').select('id')
        .eq('organization_id', orgId).eq('period_month', month).eq('period_year', year);
      const runIds = (runs || []).map((r: any) => r.id);
      if (runIds.length === 0) return [];
      const { data: lines } = await supabase
        .from('payroll_lines')
        .select('employee_id, gross_salary, pension_employee, pension_employer')
        .in('payroll_run_id', runIds);
      const employeeIds = Array.from(new Set((lines || []).map((l: any) => l.employee_id)));
      const { data: employees } = await supabase
        .from('employees').select('id, first_name, last_name, pension_id, bank_name').in('id', employeeIds);
      const empMap = new Map((employees || []).map((e: any) => [e.id, e]));
      return (lines || []).map((l: any) => {
        const e = empMap.get(l.employee_id);
        const gross = Number(l.gross_salary || 0);
        const empCon = Number(l.pension_employee || gross * 0.08);
        const erCon = Number(l.pension_employer || gross * 0.10);
        return {
          name: e ? `${e.first_name} ${e.last_name}` : '',
          pfa: e?.bank_name || '',
          rsa: e?.pension_id || '',
          gross,
          empCon,
          erCon,
          total: empCon + erCon,
        };
      });
    },
  });

  const totals = useMemo(() => (data || []).reduce((a, r) => ({
    gross: a.gross + r.gross, empCon: a.empCon + r.empCon, erCon: a.erCon + r.erCon, total: a.total + r.total,
  }), { gross: 0, empCon: 0, erCon: 0, total: 0 }), [data]);

  const handleExport = () => {
    const rows = (data || []).map(r => ({
      'Employee': r.name, 'PFA': r.pfa, 'RSA PIN': r.rsa,
      'Gross Pay': r.gross.toFixed(2),
      'Employee 8%': r.empCon.toFixed(2),
      'Employer 10%': r.erCon.toFixed(2),
      'Total': r.total.toFixed(2),
    }));
    downloadXLSX(rows, `Pension_${orgName}_${year}_${String(month).padStart(2,'0')}`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Pension Remittance — {periodLabel(month, year)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 no-print">
          <div><Label>Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
          </Button>
          <div className="flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={!data || data.length === 0} />
          </div>
        </div>
        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — Pension Remittance</h2>
            <p className="text-sm">Period: {periodLabel(month, year)}</p>
          </div>
          {isLoading ? <LoadingRows /> : !data || data.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>PFA</TableHead><TableHead>RSA PIN</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Employee 8%</TableHead>
                <TableHead className="text-right">Employer 10%</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell><TableCell>{r.pfa}</TableCell><TableCell>{r.rsa}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.empCon)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.erCon)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow>
                <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.gross)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.empCon)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.erCon)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.total)}</TableCell>
              </TableRow></TableFooter>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// TAB 3 — WHT Register
// =========================================================
const WHT_CATEGORIES = [
  { label: 'Services 10%', rate: 10 },
  { label: 'Rent 10%', rate: 10 },
  { label: 'Contracts 5%', rate: 5 },
  { label: 'Dividends 10%', rate: 10 },
  { label: 'Interest 10%', rate: 10 },
];

function WHTTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);
  const [vendorId, setVendorId] = useState<string>('all');
  const [trigger, setTrigger] = useState(0);
  const [rates, setRates] = useState<Record<string, number>>({});

  const { data: vendors } = useQuery({
    queryKey: ['vendors-wht', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name, rc_number').eq('organization_id', orgId);
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['wht', orgId, from, to, vendorId, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      let q = supabase.from('ap_payments')
        .select('id, payment_number, vendor_id, payment_date, total_amount')
        .eq('organization_id', orgId).gte('payment_date', from).lte('payment_date', to);
      if (vendorId !== 'all') q = q.eq('vendor_id', vendorId);
      const { data: payments } = await q;
      const vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));
      return (payments || []).map((p: any) => {
        const v = vendorMap.get(p.vendor_id);
        return {
          id: p.id,
          vendor: v?.name || '',
          tin: v?.rc_number || '',
          invoiceNo: p.payment_number,
          invoiceDate: p.payment_date,
          paymentDate: p.payment_date,
          gross: Number(p.total_amount || 0),
        };
      });
    },
  });

  const getRate = (id: string) => rates[id] ?? 10;

  const rowsComputed = useMemo(() => (data || []).map(r => {
    const rate = getRate(r.id);
    const wht = r.gross * (rate / 100);
    return { ...r, rate, wht, net: r.gross - wht };
  }), [data, rates]);

  const totals = useMemo(() => rowsComputed.reduce((a, r) => ({
    gross: a.gross + r.gross, wht: a.wht + r.wht, net: a.net + r.net,
  }), { gross: 0, wht: 0, net: 0 }), [rowsComputed]);

  const handleExport = () => {
    const rows = rowsComputed.map(r => ({
      'Vendor': r.vendor, 'TIN': r.tin, 'Invoice/Payment No': r.invoiceNo,
      'Invoice Date': r.invoiceDate, 'Payment Date': r.paymentDate,
      'Gross': r.gross.toFixed(2), 'WHT Rate %': r.rate, 'WHT Amount': r.wht.toFixed(2), 'Net Paid': r.net.toFixed(2),
    }));
    downloadXLSX(rows, `WHT_${orgName}_${from}_to_${to}`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>WHT Deduction Register</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 no-print">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {(vendors || []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
          </Button>
          <div className="flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={rowsComputed.length === 0} />
          </div>
        </div>
        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — WHT Register</h2>
            <p className="text-sm">Period: {from} to {to}</p>
          </div>
          {isLoading ? <LoadingRows /> : rowsComputed.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vendor</TableHead><TableHead>TIN</TableHead><TableHead>Ref</TableHead>
                <TableHead>Payment Date</TableHead><TableHead className="text-right">Gross</TableHead>
                <TableHead>WHT Rate</TableHead><TableHead className="text-right">WHT</TableHead>
                <TableHead className="text-right">Net Paid</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rowsComputed.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.vendor}</TableCell><TableCell>{r.tin}</TableCell>
                    <TableCell>{r.invoiceNo}</TableCell><TableCell>{r.paymentDate}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                    <TableCell>
                      <Select value={String(r.rate)} onValueChange={v => setRates(prev => ({ ...prev, [r.id]: Number(v) }))}>
                        <SelectTrigger className="h-8 w-32 no-print"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WHT_CATEGORIES.map(c => <SelectItem key={c.label} value={String(c.rate)}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="hidden print:inline">{r.rate}%</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.wht)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow>
                <TableCell colSpan={4} className="font-bold">Totals</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.gross)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.wht)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.net)}</TableCell>
              </TableRow></TableFooter>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// TAB 4 — VAT Report (Form 002)
// =========================================================
function VATTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trigger, setTrigger] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['vat', orgId, month, year, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      const end = new Date(year, month, 0).toISOString().slice(0, 10);
      const [arRes, apRes] = await Promise.all([
        supabase.from('ar_invoices').select('invoice_number, invoice_date, subtotal, tax_amount, total_amount')
          .eq('organization_id', orgId).gte('invoice_date', start).lte('invoice_date', end),
        supabase.from('ap_invoices').select('invoice_number, invoice_date, subtotal, tax_amount, total_amount')
          .eq('organization_id', orgId).gte('invoice_date', start).lte('invoice_date', end),
      ]);
      const output = (arRes.data || []).map((i: any) => ({ ...i, kind: 'Output (Sales)' }));
      const input = (apRes.data || []).map((i: any) => ({ ...i, kind: 'Input (Purchases)' }));
      return { output, input };
    },
  });

  const totals = useMemo(() => {
    const out = (data?.output || []).reduce((s: number, i: any) => s + Number(i.tax_amount || 0), 0);
    const inp = (data?.input || []).reduce((s: number, i: any) => s + Number(i.tax_amount || 0), 0);
    return { output: out, input: inp, net: out - inp };
  }, [data]);

  const handleExport = () => {
    const rows = [
      ...(data?.output || []).map((i: any) => ({ Type: 'Output VAT', Invoice: i.invoice_number, Date: i.invoice_date, Subtotal: Number(i.subtotal||0).toFixed(2), VAT: Number(i.tax_amount||0).toFixed(2) })),
      ...(data?.input || []).map((i: any) => ({ Type: 'Input VAT', Invoice: i.invoice_number, Date: i.invoice_date, Subtotal: Number(i.subtotal||0).toFixed(2), VAT: Number(i.tax_amount||0).toFixed(2) })),
      { Type: 'Total Output VAT', Invoice: '', Date: '', Subtotal: '', VAT: totals.output.toFixed(2) },
      { Type: 'Total Input VAT', Invoice: '', Date: '', Subtotal: '', VAT: totals.input.toFixed(2) },
      { Type: 'Net VAT Payable', Invoice: '', Date: '', Subtotal: '', VAT: totals.net.toFixed(2) },
    ];
    downloadXLSX(rows, `VAT_Form002_${orgName}_${year}_${String(month).padStart(2,'0')}`);
  };

  const allLines = [...(data?.output || []), ...(data?.input || [])];

  return (
    <Card>
      <CardHeader><CardTitle>VAT Report (FIRS Form 002) — {periodLabel(month, year)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 no-print">
          <div><Label>Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
          </Button>
          <div className="flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={allLines.length === 0} />
          </div>
        </div>
        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — VAT Report (Form 002)</h2>
            <p className="text-sm">Period: {periodLabel(month, year)}</p>
          </div>
          {isLoading ? <LoadingRows /> : allLines.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 border rounded"><div className="text-xs text-muted-foreground">Output VAT (Sales)</div><div className="text-xl font-bold">{formatCurrency(totals.output)}</div></div>
                <div className="p-4 border rounded"><div className="text-xs text-muted-foreground">Input VAT (Purchases)</div><div className="text-xl font-bold">{formatCurrency(totals.input)}</div></div>
                <div className="p-4 border rounded bg-muted/40"><div className="text-xs text-muted-foreground">Net VAT Payable</div><div className="text-xl font-bold">{formatCurrency(totals.net)}</div></div>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">VAT 7.5%</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {allLines.map((i: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{i.kind}</TableCell>
                      <TableCell>{i.invoice_number}</TableCell>
                      <TableCell>{i.invoice_date}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(i.subtotal||0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(i.tax_amount||0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// TAB 5 — NHF Deduction
// =========================================================
function NHFTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trigger, setTrigger] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['nhf', orgId, month, year, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      const { data: runs } = await supabase.from('payroll_runs').select('id')
        .eq('organization_id', orgId).eq('period_month', month).eq('period_year', year);
      const runIds = (runs || []).map((r: any) => r.id);
      if (runIds.length === 0) return [];
      const { data: lines } = await supabase.from('payroll_lines')
        .select('employee_id, gross_salary').in('payroll_run_id', runIds);
      const ids = Array.from(new Set((lines || []).map((l: any) => l.employee_id)));
      const { data: employees } = await supabase.from('employees')
        .select('id, first_name, last_name, employee_number').in('id', ids);
      const empMap = new Map((employees || []).map((e: any) => [e.id, e]));
      return (lines || []).map((l: any) => {
        const e = empMap.get(l.employee_id);
        const basic = Number(l.gross_salary || 0);
        const nhf = basic * 0.025;
        return {
          name: e ? `${e.first_name} ${e.last_name}` : '',
          staffId: e?.employee_number || '',
          basic, nhf, employerMatch: nhf,
        };
      });
    },
  });

  const totals = useMemo(() => (data || []).reduce((a, r) => ({
    basic: a.basic + r.basic, nhf: a.nhf + r.nhf, employerMatch: a.employerMatch + r.employerMatch,
  }), { basic: 0, nhf: 0, employerMatch: 0 }), [data]);

  const handleExport = () => {
    const rows = (data || []).map(r => ({
      'Employee': r.name, 'Staff ID': r.staffId,
      'Basic Salary': r.basic.toFixed(2), 'NHF Rate': '2.5%',
      'NHF Amount': r.nhf.toFixed(2), 'Employer Match': r.employerMatch.toFixed(2),
    }));
    downloadXLSX(rows, `NHF_${orgName}_${year}_${String(month).padStart(2,'0')}`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>NHF Deduction Report — {periodLabel(month, year)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 no-print">
          <div><Label>Month</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
          </Button>
          <div className="flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={!data || data.length === 0} />
          </div>
        </div>
        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — NHF Deduction</h2>
            <p className="text-sm">Period: {periodLabel(month, year)}</p>
          </div>
          {isLoading ? <LoadingRows /> : !data || data.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>Staff ID</TableHead>
                <TableHead className="text-right">Basic</TableHead><TableHead>NHF Rate</TableHead>
                <TableHead className="text-right">NHF</TableHead><TableHead className="text-right">Employer Match</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell><TableCell>{r.staffId}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.basic)}</TableCell>
                    <TableCell>2.5%</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.nhf)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.employerMatch)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow>
                <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.basic)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.nhf)}</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totals.employerMatch)}</TableCell>
              </TableRow></TableFooter>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// TAB 6 — Annual Tax Summary
// =========================================================
function AnnualTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [trigger, setTrigger] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['annual', orgId, year, trigger],
    enabled: trigger > 0,
    queryFn: async () => {
      const { data: runs } = await supabase.from('payroll_runs').select('id')
        .eq('organization_id', orgId).eq('period_year', year);
      const runIds = (runs || []).map((r: any) => r.id);
      if (runIds.length === 0) return [];
      const { data: lines } = await supabase.from('payroll_lines')
        .select('employee_id, gross_salary, pension_employee, tax_amount').in('payroll_run_id', runIds);
      const byEmp = new Map<string, { gross: number; pension: number; paye: number; nhf: number }>();
      (lines || []).forEach((l: any) => {
        const gross = Number(l.gross_salary || 0);
        const cur = byEmp.get(l.employee_id) || { gross: 0, pension: 0, paye: 0, nhf: 0 };
        cur.gross += gross;
        cur.pension += Number(l.pension_employee || gross * 0.08);
        cur.paye += Number(l.tax_amount || 0);
        cur.nhf += gross * 0.025;
        byEmp.set(l.employee_id, cur);
      });
      const ids = Array.from(byEmp.keys());
      const { data: employees } = await supabase.from('employees')
        .select('id, first_name, last_name, tax_id').in('id', ids);
      const empMap = new Map((employees || []).map((e: any) => [e.id, e]));
      return Array.from(byEmp.entries()).map(([empId, v]) => {
        const e = empMap.get(empId);
        return {
          name: e ? `${e.first_name} ${e.last_name}` : '',
          tin: e?.tax_id || '',
          gross: v.gross, paye: v.paye, pension: v.pension, nhf: v.nhf,
        };
      });
    },
  });

  const totals = useMemo(() => (data || []).reduce((a, r) => ({
    gross: a.gross + r.gross, paye: a.paye + r.paye, pension: a.pension + r.pension, nhf: a.nhf + r.nhf,
  }), { gross: 0, paye: 0, pension: 0, nhf: 0 }), [data]);

  const handleExport = () => {
    const rows = (data || []).map(r => ({
      'Employee': r.name, 'TIN': r.tin,
      'Annual Gross': r.gross.toFixed(2), 'Annual PAYE': r.paye.toFixed(2),
      'Annual Pension': r.pension.toFixed(2), 'Annual NHF': r.nhf.toFixed(2),
    }));
    rows.push({ 'Employee': 'TOTAL', 'TIN': '', 'Annual Gross': totals.gross.toFixed(2), 'Annual PAYE': totals.paye.toFixed(2), 'Annual Pension': totals.pension.toFixed(2), 'Annual NHF': totals.nhf.toFixed(2) });
    rows.push({ 'Employee': 'For FIRS Form A and H submission', 'TIN': '', 'Annual Gross': '', 'Annual PAYE': '', 'Annual Pension': '', 'Annual NHF': '' });
    downloadXLSX(rows, `AnnualTaxSummary_${orgName}_${year}`);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Annual Tax Summary — {year}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 no-print">
          <div><Label>Year</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => setTrigger(t => t + 1)} disabled={isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}
          </Button>
          <div className="md:col-span-2 flex items-end justify-end">
            <PrintExportBar onPrint={() => window.print()} onExport={handleExport} disabled={!data || data.length === 0} />
          </div>
        </div>
        <div className="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">{orgName} — Annual Tax Summary {year}</h2>
          </div>
          {isLoading ? <LoadingRows /> : !data || data.length === 0 ? (
            trigger === 0 ? <EmptyState msg="Click Generate Report to load data." /> : <EmptyState />
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead><TableHead>TIN</TableHead>
                  <TableHead className="text-right">Annual Gross</TableHead>
                  <TableHead className="text-right">Annual PAYE</TableHead>
                  <TableHead className="text-right">Annual Pension</TableHead>
                  <TableHead className="text-right">Annual NHF</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell><TableCell>{r.tin}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.paye)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.pension)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.nhf)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter><TableRow>
                  <TableCell colSpan={2} className="font-bold">Company Totals</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.gross)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.paye)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.pension)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.nhf)}</TableCell>
                </TableRow></TableFooter>
              </Table>
              <p className="text-xs text-muted-foreground italic mt-4">For FIRS Form A and H submission</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================
// MAIN PAGE
// =========================================================
export default function ComplianceReports() {
  const { organizationId, roles, isAdmin, loading } = useAuth();
  const branding = useOrgBranding();

  const hasAccess = isAdmin || roles.some(r => (ALLOWED_ROLES as readonly string[]).includes(r));

  if (loading) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }
  if (!organizationId) {
    return <div className="p-6 text-sm text-muted-foreground">Organization not set.</div>;
  }
  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-2">You need admin, HR manager, payroll manager, or accounts payable role to view compliance reports.</p>
        </CardContent></Card>
      </div>
    );
  }

  const orgName = branding?.appName || 'Organization';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print">
        <PageHeader
          title="Nigerian Statutory Compliance Reports"
          description="PAYE, Pension, WHT, VAT, NHF, and Annual Tax Summary for FIRS and statutory bodies."
        />
      </div>
      <Tabs defaultValue="paye" className="w-full">
        <TabsList className="no-print flex-wrap h-auto">
          <TabsTrigger value="paye">PAYE</TabsTrigger>
          <TabsTrigger value="pension">Pension</TabsTrigger>
          <TabsTrigger value="wht">WHT</TabsTrigger>
          <TabsTrigger value="vat">VAT (Form 002)</TabsTrigger>
          <TabsTrigger value="nhf">NHF</TabsTrigger>
          <TabsTrigger value="annual">Annual Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="paye"><PAYETab orgId={organizationId} orgName={orgName} /></TabsContent>
        <TabsContent value="pension"><PensionTab orgId={organizationId} orgName={orgName} /></TabsContent>
        <TabsContent value="wht"><WHTTab orgId={organizationId} orgName={orgName} /></TabsContent>
        <TabsContent value="vat"><VATTab orgId={organizationId} orgName={orgName} /></TabsContent>
        <TabsContent value="nhf"><NHFTab orgId={organizationId} orgName={orgName} /></TabsContent>
        <TabsContent value="annual"><AnnualTab orgId={organizationId} orgName={orgName} /></TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type EntityKey = 'vendors' | 'items' | 'customers' | 'locations' | 'gl_accounts';

interface EntityConfig {
  key: EntityKey;
  label: string;
  table: string;
  sheetAliases: string[];
  required: string[];
  description: string;
  // Map XLSX header (lowercased) -> DB column. If header missing, skip.
  mapRow: (row: Record<string, any>, organization_id: string) => Record<string, any> | null;
}

const norm = (s: any) => (s == null ? '' : String(s).trim());
const numOr = (v: any, d: number | null = null) => {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return isNaN(n) ? d : n;
};
const boolOr = (v: any, d = true) => {
  if (v === null || v === undefined || v === '') return d;
  const s = String(v).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'active'].includes(s)) return true;
  if (['false', 'no', 'n', '0', 'inactive'].includes(s)) return false;
  return d;
};

// Lowercase keys for case-insensitive header matching
const lowerKeys = (row: Record<string, any>) => {
  const o: Record<string, any> = {};
  Object.entries(row).forEach(([k, v]) => { o[String(k).trim().toLowerCase()] = v; });
  return o;
};
const pick = (r: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) {
    const v = r[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
};

const ENTITIES: EntityConfig[] = [
  {
    key: 'vendors',
    label: 'Vendors',
    table: 'vendors',
    sheetAliases: ['vendors', 'vendor'],
    required: ['code', 'name'],
    description: 'Vendor master data. Required: code, name.',
    mapRow: (raw, organization_id) => {
      const r = lowerKeys(raw);
      const code = norm(pick(r, 'code', 'vendor code'));
      const name = norm(pick(r, 'name', 'vendor name'));
      if (!code || !name) return null;
      const cats = norm(pick(r, 'service_categories', 'categories', 'category'));
      return {
        organization_id,
        code,
        name,
        email: norm(pick(r, 'email')) || null,
        phone: norm(pick(r, 'phone')) || null,
        address: norm(pick(r, 'address')) || null,
        city: norm(pick(r, 'city')) || null,
        country: norm(pick(r, 'country')) || null,
        payment_terms: numOr(pick(r, 'payment_terms', 'payment terms'), 30),
        rc_number: norm(pick(r, 'rc_number', 'rc number')) || null,
        bank_name: norm(pick(r, 'bank_name', 'bank name')) || null,
        bank_account_number: norm(pick(r, 'bank_account_number', 'bank account number', 'account number')) || null,
        project_size_capacity: (norm(pick(r, 'project_size_capacity', 'size')) || 'medium').toLowerCase(),
        service_categories: cats ? cats.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : [],
        status: 'draft',
      };
    },
  },
  {
    key: 'items',
    label: 'Items',
    table: 'items',
    sheetAliases: ['items', 'item'],
    required: ['code', 'name'],
    description: 'Inventory and service items. Required: code, name.',
    mapRow: (raw, organization_id) => {
      const r = lowerKeys(raw);
      const code = norm(pick(r, 'code', 'item code'));
      const name = norm(pick(r, 'name', 'item name'));
      if (!code || !name) return null;
      return {
        organization_id,
        code,
        name,
        description: norm(pick(r, 'description')) || null,
        category: norm(pick(r, 'category')) || null,
        unit_of_measure: norm(pick(r, 'unit_of_measure', 'uom', 'unit')) || 'EA',
        unit_cost: numOr(pick(r, 'unit_cost', 'cost'), 0),
        is_active: boolOr(pick(r, 'is_active', 'active'), true),
      };
    },
  },
  {
    key: 'customers',
    label: 'Customers',
    table: 'customers',
    sheetAliases: ['customers', 'customer'],
    required: ['code', 'name'],
    description: 'Customer master data. Required: code, name.',
    mapRow: (raw, organization_id) => {
      const r = lowerKeys(raw);
      const code = norm(pick(r, 'code', 'customer code'));
      const name = norm(pick(r, 'name', 'customer name'));
      if (!code || !name) return null;
      return {
        organization_id,
        code,
        name,
        email: norm(pick(r, 'email')) || null,
        phone: norm(pick(r, 'phone')) || null,
        address: norm(pick(r, 'address')) || null,
        city: norm(pick(r, 'city')) || null,
        country: norm(pick(r, 'country')) || null,
        payment_terms: numOr(pick(r, 'payment_terms', 'payment terms'), 30),
        credit_limit: numOr(pick(r, 'credit_limit', 'credit limit'), 0),
        is_active: boolOr(pick(r, 'is_active', 'active'), true),
      };
    },
  },
  {
    key: 'locations',
    label: 'Locations',
    table: 'locations',
    sheetAliases: ['locations', 'location'],
    required: ['code', 'name'],
    description: 'Warehouses and sites. Required: code, name.',
    mapRow: (raw, organization_id) => {
      const r = lowerKeys(raw);
      const code = norm(pick(r, 'code', 'location code'));
      const name = norm(pick(r, 'name', 'location name'));
      if (!code || !name) return null;
      return {
        organization_id,
        code,
        name,
        address: norm(pick(r, 'address')) || null,
        is_active: boolOr(pick(r, 'is_active', 'active'), true),
      };
    },
  },
  {
    key: 'gl_accounts',
    label: 'Chart of Accounts',
    table: 'gl_accounts',
    sheetAliases: ['chart of accounts', 'gl_accounts', 'coa', 'accounts'],
    required: ['account_code', 'account_name', 'account_type'],
    description: 'GL accounts. Required: account_code, account_name, account_type (asset/liability/equity/revenue/expense).',
    mapRow: (raw, organization_id) => {
      const r = lowerKeys(raw);
      const account_code = norm(pick(r, 'account_code', 'code'));
      const account_name = norm(pick(r, 'account_name', 'name'));
      const account_type = norm(pick(r, 'account_type', 'type')).toLowerCase();
      if (!account_code || !account_name || !account_type) return null;
      const valid = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      if (!valid.includes(account_type)) return null;
      const normalDefault = ['asset', 'expense'].includes(account_type) ? 'debit' : 'credit';
      return {
        organization_id,
        account_code,
        account_name,
        account_type,
        normal_balance: norm(pick(r, 'normal_balance')).toLowerCase() || normalDefault,
        description: norm(pick(r, 'description')) || null,
        is_header: boolOr(pick(r, 'is_header', 'header'), false),
        is_active: boolOr(pick(r, 'is_active', 'active'), true),
        status: 'approved',
      };
    },
  },
];

interface UploadResult {
  entity: string;
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export function BulkUploadPanel() {
  const { organizationId } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const sheets: Record<string, any[][]> = {
      Vendors: [
        ['code*', 'name*', 'email', 'phone', 'address', 'city', 'country', 'payment_terms', 'rc_number', 'bank_name', 'bank_account_number', 'project_size_capacity', 'service_categories'],
        ['V001', 'Acme Supplies Ltd', 'sales@acme.ng', '08012345678', '12 Marina', 'Lagos', 'Nigeria', 30, 'RC123456', 'GTBank', '0123456789', 'medium', 'IT;Office Supplies'],
      ],
      Items: [
        ['code*', 'name*', 'description', 'category', 'unit_of_measure', 'unit_cost', 'is_active'],
        ['ITM001', 'A4 Paper Ream', '80gsm white', 'Stationery', 'EA', 2500, true],
      ],
      Customers: [
        ['code*', 'name*', 'email', 'phone', 'address', 'city', 'country', 'payment_terms', 'credit_limit', 'is_active'],
        ['CUST001', 'Global Trading Co', 'ap@global.com', '08087654321', '5 Adeola Odeku', 'Lagos', 'Nigeria', 30, 1000000, true],
      ],
      Locations: [
        ['code*', 'name*', 'address', 'is_active'],
        ['WH-LAG', 'Lagos Main Warehouse', 'Apapa Industrial Estate', true],
      ],
      'Chart of Accounts': [
        ['account_code*', 'account_name*', 'account_type*', 'normal_balance', 'description', 'is_header', 'is_active'],
        ['1100', 'Cash on Hand', 'asset', 'debit', 'Petty cash', false, true],
      ],
    };

    Object.entries(sheets).forEach(([name, rows]) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, 'AOTHR_Bulk_Upload_Template.xlsx');
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    setResults([]);
  };

  const findSheet = (wb: XLSX.WorkBook, aliases: string[]): string | null => {
    const lower = wb.SheetNames.map(n => ({ orig: n, low: n.toLowerCase().trim() }));
    for (const a of aliases) {
      const m = lower.find(s => s.low === a.toLowerCase());
      if (m) return m.orig;
    }
    return null;
  };

  const processUpload = async () => {
    if (!file || !organizationId) {
      toast.error('Select a file first');
      return;
    }
    setProcessing(true);
    setResults([]);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const allResults: UploadResult[] = [];

      for (const ent of ENTITIES) {
        const sheetName = findSheet(wb, ent.sheetAliases);
        if (!sheetName) continue;

        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: '' });
        if (!rows.length) continue;

        const result: UploadResult = { entity: ent.label, total: rows.length, inserted: 0, skipped: 0, errors: [] };
        const toInsert: any[] = [];

        rows.forEach((raw, idx) => {
          try {
            const mapped = ent.mapRow(raw, organizationId);
            if (!mapped) {
              result.skipped++;
              result.errors.push({ row: idx + 2, message: `Missing required fields (${ent.required.join(', ')})` });
              return;
            }
            toInsert.push(mapped);
          } catch (e: any) {
            result.skipped++;
            result.errors.push({ row: idx + 2, message: e.message || 'Parse error' });
          }
        });

        // Insert in batches of 100
        for (let i = 0; i < toInsert.length; i += 100) {
          const batch = toInsert.slice(i, i + 100);
          const { error, count } = await supabase
            .from(ent.table as any)
            .insert(batch as any, { count: 'exact' });
          if (error) {
            // Fall back to per-row inserts to capture which fail
            for (let j = 0; j < batch.length; j++) {
              const { error: rowErr } = await supabase.from(ent.table as any).insert(batch[j] as any);
              if (rowErr) {
                result.skipped++;
                result.errors.push({ row: i + j + 2, message: rowErr.message });
              } else {
                result.inserted++;
              }
            }
          } else {
            result.inserted += count ?? batch.length;
          }
        }

        allResults.push(result);
      }

      if (allResults.length === 0) {
        toast.error('No matching sheets found. Use the template sheet names.');
      } else {
        const totalIns = allResults.reduce((a, r) => a + r.inserted, 0);
        toast.success(`Imported ${totalIns} record${totalIns === 1 ? '' : 's'} across ${allResults.length} entity type(s)`);
      }
      setResults(allResults);
    } catch (e: any) {
      toast.error(e.message || 'Failed to process file');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk Data Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Download the template, fill in your data, then upload the .xlsx file. The importer reads sheets named:
                <span className="font-medium"> Vendors, Items, Customers, Locations, Chart of Accounts</span>.
                You may include only the sheets you need.
              </p>
              <p className="text-xs text-muted-foreground">
                Headers are case-insensitive. Columns marked with * are required. Existing records with the same code will fail with a clear error.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Download Template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choose File
            </Button>
            {file && (
              <Badge variant="secondary" className="self-center">{file.name}</Badge>
            )}
            <Button onClick={processUpload} disabled={!file || processing} className="gap-2">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {processing ? 'Importing...' : 'Import'}
            </Button>
          </div>

          <Tabs defaultValue="vendors">
            <TabsList className="flex-wrap h-auto">
              {ENTITIES.map(e => (
                <TabsTrigger key={e.key} value={e.key}>{e.label}</TabsTrigger>
              ))}
            </TabsList>
            {ENTITIES.map(e => (
              <TabsContent key={e.key} value={e.key} className="text-sm text-muted-foreground">
                <p className="mb-2">{e.description}</p>
                <p>Sheet name: <span className="font-mono text-foreground">{e.sheetAliases[0]}</span></p>
                <p>Required columns: <span className="font-mono text-foreground">{e.required.join(', ')}</span></p>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map(r => (
              <div key={r.entity} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium flex items-center gap-2">
                    {r.errors.length === 0
                      ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : <AlertCircle className="h-4 w-4 text-warning" />}
                    {r.entity}
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-success text-success-foreground">{r.inserted} inserted</Badge>
                    {r.skipped > 0 && <Badge variant="destructive">{r.skipped} skipped</Badge>}
                    <Badge variant="outline">{r.total} total rows</Badge>
                  </div>
                </div>
                {r.errors.length > 0 && (
                  <ScrollArea className="h-40 rounded border bg-muted/30 p-2">
                    <div className="text-xs space-y-1 font-mono">
                      {r.errors.map((er, i) => (
                        <div key={i}>Row {er.row}: {er.message}</div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

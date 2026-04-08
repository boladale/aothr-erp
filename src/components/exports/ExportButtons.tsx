import { Button } from '@/components/ui/button';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { exportToCSV, exportToXLSX, printReport } from '@/lib/export-utils';

interface ExportButtonsProps {
  data: Record<string, any>[];
  filename: string;
  title: string;
  subtitle?: string;
  columns: { key: string; header: string }[];
  orgName?: string;
  logoUrl?: string;
}

export function ExportButtons({ data, filename, title, subtitle, columns, orgName, logoUrl }: ExportButtonsProps) {
  const getMappedData = () =>
    data.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach(col => { obj[col.header] = row[col.key]; });
      return obj;
    });

  const handleCSV = () => exportToCSV(getMappedData(), filename);

  const handleXLSX = () => exportToXLSX(getMappedData(), filename);

  const handlePrint = () => {
    const headers = columns.map(c => c.header);
    const rows = data.map(row => columns.map(c => String(row[c.key] ?? '')));
    printReport(title, headers, rows, { subtitle, orgName, logoUrl });
  };

  return (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={handleCSV} disabled={data.length === 0}>
        <Download className="h-3 w-3 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleXLSX} disabled={data.length === 0}>
        <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={data.length === 0}>
        <Printer className="h-3 w-3 mr-1" /> Print
      </Button>
    </div>
  );
}

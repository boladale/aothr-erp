import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToCSV, exportToExcel, type ExportRow } from '@/lib/export';

interface ExportButtonProps {
  rows: ExportRow[];
  filename: string;
  sheetName?: string;
  disabled?: boolean;
}

export function ExportButton({ rows, filename, sheetName, disabled }: ExportButtonProps) {
  const isEmpty = !rows || rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isEmpty}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToExcel(rows, filename, sheetName)}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(rows, filename)}>
          <FileText className="mr-2 h-4 w-4" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

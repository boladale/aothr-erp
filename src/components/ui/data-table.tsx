import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  onRowClick,
  emptyMessage = 'No data found',
  pageSize = 25,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const paginatedData = data.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const allPageSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.includes(item.id));
  const somePageSelected = paginatedData.some(item => selectedIds.includes(item.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter(id => !paginatedData.find(item => item.id === id)));
    } else {
      const newIds = [...new Set([...selectedIds, ...paginatedData.map(item => item.id)])];
      onSelectionChange(newIds);
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && <TableHead className="w-10" />}
              {columns.map(col => (
                <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                {columns.map(col => (
                  <TableCell key={col.key}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
              )}
              {columns.map(col => (
                <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map(item => (
              <TableRow
                key={item.id}
                className={`${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleOne(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                )}
                {columns.map(col => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render
                      ? col.render(item)
                      : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, data.length)} of {data.length}
            {selectable && selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">Page {currentPage + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {selectable && selectedIds.length > 0 && totalPages <= 1 && (
        <p className="text-sm text-muted-foreground px-2">{selectedIds.length} selected</p>
      )}
    </div>
  );
}

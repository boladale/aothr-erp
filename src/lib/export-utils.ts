/**
 * CSV + Print/PDF export utilities
 */

/** Convert array of objects to CSV string and trigger download */
export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ];
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Open a print-friendly version of data in a new window */
export function printReport(title: string, headers: string[], rows: string[][], options?: { subtitle?: string }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header p { font-size: 12px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; border: 1px solid #ddd; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    td { padding: 6px 10px; border: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    ${options?.subtitle ? `<p>${options.subtitle}</p>` : ''}
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <div class="footer">Printed from BizOps ERP</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

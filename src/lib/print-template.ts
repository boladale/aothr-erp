/**
 * Shared branded print template.
 * Wraps arbitrary document HTML with a consistent org-branded header/footer
 * so every printed document (PO, RFQ, Invoice, Receipt, Report, etc.)
 * looks the same across the app.
 */

export interface PrintBrandingMeta {
  orgName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  documentTitle: string;        // e.g. "Purchase Order"
  documentNumber?: string;      // e.g. "PO-2026-0001"
  documentDate?: string;        // e.g. "19 Jul 2026"
  status?: string;              // e.g. "APPROVED"
  footerNote?: string;          // e.g. "Thank you for your business"
  currency?: string;            // for footer
  preparedBy?: string;
}

const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    padding: 32px; color: #1a1a1a; font-size: 12px; line-height: 1.5;
  }
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 16px; border-bottom: 3px solid #1e40af; margin-bottom: 20px;
  }
  .doc-header .org { flex: 1; }
  .doc-header .org img { max-height: 56px; margin-bottom: 8px; }
  .doc-header .org .name { font-size: 18px; font-weight: 700; color: #1e40af; }
  .doc-header .org .contact { font-size: 10px; color: #555; margin-top: 4px; white-space: pre-line; }
  .doc-header .meta { text-align: right; }
  .doc-header .meta .title { font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e40af; }
  .doc-header .meta .number { font-size: 14px; font-weight: 600; margin-top: 6px; }
  .doc-header .meta .date, .doc-header .meta .status { font-size: 11px; color: #555; margin-top: 2px; }
  .doc-header .meta .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 4px; background: #dbeafe; color: #1e40af; font-weight: 600; text-transform: uppercase; font-size: 10px; }
  .doc-body { margin-bottom: 24px; }
  .doc-body table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .doc-body th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  .doc-body td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  .doc-body tr:last-child td { border-bottom: none; }
  .doc-body .totals { margin-left: auto; width: 40%; margin-top: 12px; }
  .doc-body .totals td { padding: 4px 8px; border: none; }
  .doc-body .totals .grand { font-weight: 700; font-size: 14px; border-top: 2px solid #1a1a1a; }
  .doc-footer {
    position: fixed; bottom: 20px; left: 32px; right: 32px;
    border-top: 1px solid #e2e8f0; padding-top: 8px;
    font-size: 9px; color: #777; display: flex; justify-content: space-between;
  }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; gap: 32px; }
  .signatures .sig { flex: 1; text-align: center; }
  .signatures .sig .line { border-top: 1px solid #1a1a1a; margin-bottom: 4px; padding-top: 4px; }
  .signatures .sig .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  @media print {
    body { padding: 20px; }
    @page { margin: 1.2cm; size: A4; }
    .no-print { display: none !important; }
  }
`;

export function printBrandedDocument(bodyHtml: string, meta: PrintBrandingMeta) {
  const contactLines = [meta.address, meta.phone, meta.email, meta.website]
    .filter(Boolean).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${meta.documentTitle}${meta.documentNumber ? ` — ${meta.documentNumber}` : ''}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="doc-header">
    <div class="org">
      ${meta.logoUrl ? `<img src="${meta.logoUrl}" alt="${meta.orgName || 'Logo'}" />` : ''}
      ${meta.orgName ? `<div class="name">${meta.orgName}</div>` : ''}
      ${contactLines ? `<div class="contact">${contactLines}</div>` : ''}
    </div>
    <div class="meta">
      <div class="title">${meta.documentTitle}</div>
      ${meta.documentNumber ? `<div class="number">#${meta.documentNumber}</div>` : ''}
      ${meta.documentDate ? `<div class="date">${meta.documentDate}</div>` : ''}
      ${meta.status ? `<div class="status">${meta.status}</div>` : ''}
    </div>
  </div>
  <div class="doc-body">${bodyHtml}</div>
  <div class="doc-footer">
    <span>${meta.footerNote || `Generated ${new Date().toLocaleString()}`}</span>
    <span>${meta.preparedBy ? `Prepared by: ${meta.preparedBy}` : ''}</span>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

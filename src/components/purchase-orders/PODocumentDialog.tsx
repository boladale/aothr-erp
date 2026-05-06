import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { POStatus } from '@/lib/supabase';

interface POLine {
  line_number: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  description: string | null;
  items: { code: string; name: string; unit_of_measure: string } | null;
  services: { code: string; name: string } | null;
}

interface POData {
  id: string;
  po_number: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  payment_terms: string | null;
  vendor_signature_url?: string | null;
  vendor_signed_at?: string | null;
  manager_signature_url?: string | null;
  manager_signed_at?: string | null;
  vendors: { code: string; name: string; address: string | null; city: string | null; country: string | null; phone: string | null; email: string | null } | null;
  locations: { name: string; address: string | null } | null;
}

interface OrgData {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  app_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poStatus?: string;
  onStatusChange?: () => void;
}

export function PODocumentDialog({ open, onOpenChange, poId, poStatus, onStatusChange }: Props) {
  const { organizationId, user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [po, setPO] = useState<POData | null>(null);
  const [lines, setLines] = useState<POLine[]>([]);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !poId) return;
    setLoading(true);

    const fetchAll = async () => {
      const [poRes, linesRes, orgRes] = await Promise.all([
        supabase.from('purchase_orders').select('id, po_number, order_date, expected_date, subtotal, tax_amount, total_amount, notes, payment_terms, vendor_signature_url, vendor_signed_at, manager_signature_url, manager_signed_at, vendors(code, name, address, city, country, phone, email), locations(name, address)').eq('id', poId).single(),
        supabase.from('purchase_order_lines').select('line_number, quantity, unit_price, line_total, description, items(code, name, unit_of_measure), services(code, name)').eq('po_id', poId).order('line_number'),
        organizationId
          ? supabase.from('organizations').select('name, address, city, country, phone, email, logo_url, app_name').eq('id', organizationId).single()
          : Promise.resolve({ data: null }),
      ]);

      setPO(poRes.data as POData | null);
      setLines((linesRes.data || []) as POLine[]);
      if (orgRes.data) setOrg(orgRes.data as OrgData);
      setLoading(false);
    };

    fetchAll();
  }, [open, poId, organizationId]);

  const markAsSentIfApproved = async () => {
    if (poStatus !== 'approved') return;
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' as POStatus, sent_at: new Date().toISOString() })
        .eq('id', poId);
      if (error) throw error;
      toast.success('PO automatically marked as Sent');
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to auto-mark PO as sent:', err);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    // Auto-mark as sent when printing an approved PO
    markAsSentIfApproved();

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${po?.po_number || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; }
          .org-block { flex: 1; }
          .org-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .org-detail { font-size: 12px; color: #555; }
          .logo { max-height: 72px; max-width: 180px; object-fit: contain; }
          .po-title { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
          .meta-box { border: 1px solid #ddd; border-radius: 6px; padding: 14px; }
          .meta-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; font-weight: 600; }
          .meta-box p { font-size: 13px; margin-bottom: 2px; }
          .meta-box .name { font-weight: 600; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #1a1a1a; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 10px 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #f9f9f9; }
          .text-right { text-align: right; }
          .totals { margin-left: auto; width: 280px; margin-bottom: 32px; }
          .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .totals .row.grand { border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 16px; padding-top: 10px; }
          .terms { margin-bottom: 40px; padding: 16px; background: #f5f5f5; border-radius: 6px; font-size: 12px; }
          .terms h3 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
          .terms ol { padding-left: 20px; }
          .terms li { margin-bottom: 4px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
          .sig-block { text-align: center; }
          .sig-line { border-top: 1px solid #1a1a1a; margin-top: 60px; padding-top: 8px; }
          .sig-label { font-size: 12px; color: #555; }
          .sig-name { font-weight: 600; font-size: 14px; margin-top: 4px; }
          .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  if (loading || !po) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex justify-center py-16 text-muted-foreground">Loading document...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const today = format(new Date(), 'MMMM dd, yyyy');
  const orderDate = po.order_date ? format(new Date(po.order_date), 'MMMM dd, yyyy') : today;
  const expectedDate = po.expected_date ? format(new Date(po.expected_date), 'MMMM dd, yyyy') : 'TBD';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-end gap-2 mb-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
          </Button>
        </div>

        <div ref={printRef}>
          {/* Header with logo and org info */}
          <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '3px solid #1a1a1a', paddingBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div className="org-name" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{org?.name || org?.app_name || 'Organization'}</div>
              {org?.address && <div className="org-detail" style={{ fontSize: 12, color: '#555' }}>{org.address}</div>}
              {(org?.city || org?.country) && <div className="org-detail" style={{ fontSize: 12, color: '#555' }}>{[org.city, org.country].filter(Boolean).join(', ')}</div>}
              {org?.phone && <div className="org-detail" style={{ fontSize: 12, color: '#555' }}>Tel: {org.phone}</div>}
              {org?.email && <div className="org-detail" style={{ fontSize: 12, color: '#555' }}>Email: {org.email}</div>}
            </div>
            {org?.logo_url && (
              <div>
                <img src={org.logo_url} alt="Logo" className="logo" style={{ maxHeight: 72, maxWidth: 180, objectFit: 'contain' }} />
              </div>
            )}
          </div>

          {/* PO Title */}
          <div className="po-title" style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 }}>
            PURCHASE ORDER
          </div>

          {/* Meta info */}
          <div className="meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div className="meta-box" style={{ border: '1px solid #ddd', borderRadius: 6, padding: 14 }}>
              <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8, fontWeight: 600 }}>Vendor (Supplier)</h3>
              <p className="name" style={{ fontWeight: 600, fontSize: 15 }}>{po.vendors?.name || '—'}</p>
              <p style={{ fontSize: 13 }}>Code: {po.vendors?.code}</p>
              {po.vendors?.address && <p style={{ fontSize: 13 }}>{po.vendors.address}</p>}
              {(po.vendors?.city || po.vendors?.country) && <p style={{ fontSize: 13 }}>{[po.vendors.city, po.vendors.country].filter(Boolean).join(', ')}</p>}
              {po.vendors?.phone && <p style={{ fontSize: 13 }}>Tel: {po.vendors.phone}</p>}
              {po.vendors?.email && <p style={{ fontSize: 13 }}>Email: {po.vendors.email}</p>}
            </div>
            <div className="meta-box" style={{ border: '1px solid #ddd', borderRadius: 6, padding: 14 }}>
              <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8, fontWeight: 600 }}>Order Details</h3>
              <p style={{ fontSize: 13 }}><strong>PO Number:</strong> {po.po_number}</p>
              <p style={{ fontSize: 13 }}><strong>Order Date:</strong> {orderDate}</p>
              <p style={{ fontSize: 13 }}><strong>Expected Delivery:</strong> {expectedDate}</p>
              {po.locations && <p style={{ fontSize: 13 }}><strong>Ship To:</strong> {po.locations.name}{po.locations.address ? `, ${po.locations.address}` : ''}</p>}
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>#</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>Item Code</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>Description</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>UoM</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'right', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>Qty</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'right', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>Unit Price</th>
                <th style={{ background: '#1a1a1a', color: '#fff', textAlign: 'right', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const ref = line.items || line.services;
                return (
                <tr key={idx} style={{ background: idx % 2 === 1 ? '#f9f9f9' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{line.line_number}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{ref?.code || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{ref?.name || line.description || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee' }}>{line.items?.unit_of_measure || (line.services ? 'Service' : '—')}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{line.quantity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(line.unit_price)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(line.line_total || line.quantity * line.unit_price)}</td>
                </tr>
              );})}
            </tbody>
          </table>

          {/* Totals */}
          <div className="totals" style={{ marginLeft: 'auto', width: 280, marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span>Subtotal</span>
              <span>{formatCurrency(po.subtotal || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span>Tax</span>
              <span>{formatCurrency(po.tax_amount || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: 16, fontWeight: 700, borderTop: '2px solid #1a1a1a' }}>
              <span>Grand Total</span>
              <span>{formatCurrency(po.total_amount || po.subtotal || 0)}</span>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="terms" style={{ marginBottom: 40, padding: 16, background: '#f5f5f5', borderRadius: 6, fontSize: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Terms &amp; Conditions</h3>
            <ol style={{ paddingLeft: 20 }}>
              <li>Delivery must be made on or before the expected delivery date stated above.</li>
              <li>All items must conform to the specifications and quality standards agreed upon.</li>
              <li>Invoice must reference this Purchase Order number for payment processing.</li>
              <li>Payment will be processed according to the agreed payment terms after receipt and verification of goods.</li>
              <li>The Buyer reserves the right to reject goods that do not meet specifications.</li>
              <li>This Purchase Order constitutes a binding agreement upon signature by both parties.</li>
            </ol>
          </div>

          {po.notes && (
            <div style={{ marginBottom: 32, fontSize: 12 }}>
              <strong>Notes:</strong> {po.notes}
            </div>
          )}

          {/* Signature Blocks */}
          <div className="signatures" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, marginTop: 60 }}>
            <div style={{ textAlign: 'center' }}>
              {po.manager_signature_url ? (
                <img src={po.manager_signature_url} alt="Manager signature" style={{ height: 60, maxWidth: 200, objectFit: 'contain', margin: '0 auto', display: 'block' }} />
              ) : (
                <div style={{ height: 60 }} />
              )}
              <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 8 }}>
                <div style={{ fontSize: 12, color: '#555' }}>Authorized Signature</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>For: {org?.name || 'Buyer'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  Date: {po.manager_signed_at ? format(new Date(po.manager_signed_at), 'MMM dd, yyyy') : '_______________'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              {po.vendor_signature_url ? (
                <img src={po.vendor_signature_url} alt="Vendor signature" style={{ height: 60, maxWidth: 200, objectFit: 'contain', margin: '0 auto', display: 'block' }} />
              ) : (
                <div style={{ height: 60 }} />
              )}
              <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 8 }}>
                <div style={{ fontSize: 12, color: '#555' }}>Authorized Signature</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>For: {po.vendors?.name || 'Vendor'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  Date: {po.vendor_signed_at ? format(new Date(po.vendor_signed_at), 'MMM dd, yyyy') : '_______________'}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer" style={{ textAlign: 'center', marginTop: 40, fontSize: 10, color: '#999', borderTop: '1px solid #ddd', paddingTop: 12 }}>
            This document was generated on {today}. PO Reference: {po.po_number}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

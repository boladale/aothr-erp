import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Search, FileSearch } from 'lucide-react';
import { toast } from 'sonner';

interface AuditData {
  requisition: any;
  bids: any[];
  purchaseOrder: any;
  poLines: any[];
  goodsReceipts: any[];
  invoices: any[];
}

export default function ProcurementAudit() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<AuditData | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setAuditData(null);

    try {
      // Find PO by number or requisition number
      let poId: string | null = null;
      let reqData: any = null;

      // Try PO number first
      const { data: po } = await supabase.from('purchase_orders')
        .select('*, vendors(name, code)')
        .ilike('po_number', `%${search}%`)
        .limit(1).single();

      if (po) {
        poId = po.id;
        // Find linked requisition
        const { data: trace } = await supabase.from('po_line_requisition_lines')
          .select('requisition_line_id, requisition_lines(requisition_id)')
          .eq('po_line_id', (await supabase.from('purchase_order_lines').select('id').eq('po_id', po.id).limit(1)).data?.[0]?.id || '');

        if (trace?.[0]?.requisition_lines) {
          const { data: req } = await supabase.from('requisitions')
            .select('*').eq('id', (trace[0].requisition_lines as any).requisition_id).single();
          reqData = req;
        }
      } else {
        // Try requisition number
        const { data: req } = await supabase.from('requisitions')
          .select('*').ilike('req_number', `%${search}%`).limit(1).single();

        if (req) {
          reqData = req;
          // Find linked PO
          const { data: reqLines } = await supabase.from('requisition_lines').select('id').eq('requisition_id', req.id);
          if (reqLines?.length) {
            const { data: trace } = await supabase.from('po_line_requisition_lines')
              .select('po_line_id, purchase_order_lines(po_id)').in('requisition_line_id', reqLines.map(r => r.id)).limit(1);
            if (trace?.[0]) {
              const { data: foundPO } = await supabase.from('purchase_orders')
                .select('*, vendors(name, code)')
                .eq('id', (trace[0].purchase_order_lines as any).po_id).single();
              if (foundPO) poId = foundPO.id;
            }
          }
        }
      }

      if (!poId && !reqData) {
        toast.error('No matching records found');
        setLoading(false);
        return;
      }

      // Fetch all audit data
      const finalPO = poId ? (await supabase.from('purchase_orders').select('*, vendors(name, code, email, phone)').eq('id', poId).single()).data : null;
      const poLines = poId ? (await supabase.from('purchase_order_lines').select('*, items(code, name)').eq('po_id', poId).order('line_number')).data || [] : [];
      const grns = poId ? (await supabase.from('goods_receipts').select('*, locations(name), goods_receipt_lines(*, items(name))').eq('po_id', poId)).data || [] : [];
      const invs = poId ? (await supabase.from('ap_invoices').select('*, ap_invoice_lines(*)').eq('po_id', poId)).data || [] : [];

      // Fetch bids for requisition
      let bids: any[] = [];
      if (reqData) {
        const { data: bidRequests } = await supabase.from('requisition_bid_requests').select('id').eq('requisition_id', reqData.id);
        if (bidRequests?.length) {
          const { data: entries } = await supabase.from('requisition_bid_entries')
            .select('*, vendors(name, code)')
            .in('bid_request_id', bidRequests.map(b => b.id));
          bids = entries || [];
        }
      }

      setAuditData({
        requisition: reqData,
        bids,
        purchaseOrder: finalPO,
        poLines,
        goodsReceipts: grns,
        invoices: invs,
      });
    } catch (e) {
      toast.error('Failed to fetch audit data');
    } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Procurement Audit" description="Consolidated audit trail: PRN → Bids → PO → GRN → Invoice" />

        <div className="flex items-center gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by PO or PRN number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9"
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            <FileSearch className="h-4 w-4 mr-1" /> {loading ? 'Searching...' : 'Audit'}
          </Button>
        </div>

        {auditData && (
          <div className="space-y-6 mt-6">
            {/* Requisition */}
            {auditData.requisition && (
              <Card>
                <CardHeader><CardTitle className="text-sm">1. Requisition (PRN)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-muted-foreground">PRN No:</span> <span className="font-medium">{auditData.requisition.req_number}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={auditData.requisition.status} /></div>
                    <div><span className="text-muted-foreground">Department:</span> {auditData.requisition.department || '-'}</div>
                    <div><span className="text-muted-foreground">Created:</span> {new Date(auditData.requisition.created_at).toLocaleDateString()}</div>
                    {auditData.requisition.approved_at && <div><span className="text-muted-foreground">Approved:</span> {new Date(auditData.requisition.approved_at).toLocaleDateString()}</div>}
                  </div>
                  {auditData.requisition.justification && <p className="text-sm mt-2 text-muted-foreground">Justification: {auditData.requisition.justification}</p>}
                </CardContent>
              </Card>
            )}

            {/* Bids */}
            {auditData.bids.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">2. Vendor Quotes / Bids</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Recommended</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData.bids.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.vendors?.name} ({b.vendors?.code})</TableCell>
                          <TableCell className="text-right">₦{b.unit_price?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{b.quantity}</TableCell>
                          <TableCell className="text-right">₦{((b.unit_price || 0) * (b.quantity || 0)).toFixed(2)}</TableCell>
                          <TableCell>{b.is_recommended ? <Badge className="bg-primary">Winner</Badge> : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Purchase Order */}
            {auditData.purchaseOrder && (
              <Card>
                <CardHeader><CardTitle className="text-sm">3. Purchase Order</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div><span className="text-muted-foreground">PO No:</span> <span className="font-medium">{auditData.purchaseOrder.po_number}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={auditData.purchaseOrder.status} /></div>
                    <div><span className="text-muted-foreground">Vendor:</span> {auditData.purchaseOrder.vendors?.name}</div>
                    <div><span className="text-muted-foreground">Total:</span> ₦{(auditData.purchaseOrder.total_amount || 0).toFixed(2)}</div>
                    <div><span className="text-muted-foreground">Order Date:</span> {new Date(auditData.purchaseOrder.order_date).toLocaleDateString()}</div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData.poLines.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.line_number}</TableCell>
                          <TableCell>{l.items?.name} ({l.items?.code})</TableCell>
                          <TableCell className="text-right">{l.quantity}</TableCell>
                          <TableCell className="text-right">₦{l.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">₦{l.line_total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* GRNs */}
            {auditData.goodsReceipts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">4. Goods Received Notes (GRN)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {auditData.goodsReceipts.map((grn: any) => (
                    <div key={grn.id} className="border rounded p-3">
                      <div className="flex items-center gap-4 text-sm mb-2">
                        <span className="font-medium">{grn.grn_number}</span>
                        <StatusBadge status={grn.status} />
                        <span className="text-muted-foreground">Date: {new Date(grn.receipt_date).toLocaleDateString()}</span>
                        <span className="text-muted-foreground">Location: {grn.locations?.name}</span>
                        {grn.weigh_bill_number && <span className="text-muted-foreground">Weigh Bill: {grn.weigh_bill_number}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Items: {(grn.goods_receipt_lines || []).map((l: any) => `${l.items?.name} (${l.qty_received})`).join(', ')}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Invoices */}
            {auditData.invoices.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">5. AP Invoices</CardTitle></CardHeader>
                <CardContent>
                  {auditData.invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center gap-4 text-sm border-b last:border-0 py-2">
                      <span className="font-medium">{inv.invoice_number}</span>
                      <StatusBadge status={inv.status} />
                      <span className="text-muted-foreground">Date: {new Date(inv.invoice_date).toLocaleDateString()}</span>
                      <span>₦{(inv.total_amount || 0).toFixed(2)}</span>
                      <StatusBadge status={inv.payment_status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

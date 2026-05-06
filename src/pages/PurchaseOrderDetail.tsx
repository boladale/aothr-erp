import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, FileText, PenTool } from 'lucide-react';
import { AttachmentPanel } from '@/components/attachments/AttachmentPanel';
import { PODocumentDialog } from '@/components/purchase-orders/PODocumentDialog';
import { SignatureUploader } from '@/components/signatures/SignatureUploader';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { PurchaseOrder, PurchaseOrderLine, Vendor, Location, Item, POStatus } from '@/lib/supabase';

interface POWithDetails extends PurchaseOrder {
  vendors: Vendor | null;
  locations: Location | null;
}

interface POLineWithItem extends PurchaseOrderLine {
  items: Item | null;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const canApprove = hasRole('admin') || hasRole('procurement_manager');
  const canSend = canApprove || hasRole('procurement_officer');
  const [po, setPO] = useState<POWithDetails | null>(null);
  const [lines, setLines] = useState<POLineWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocument, setShowDocument] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchPO();
  }, [id]);

  const fetchPO = async () => {
    try {
      const [poRes, linesRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, vendors(*), locations(*), requisitions(req_number)').eq('id', id).single(),
        supabase.from('purchase_order_lines').select('*, items(*)').eq('po_id', id).order('line_number'),
      ]);

      if (poRes.error) throw poRes.error;
      setPO(poRes.data as POWithDetails);
      setLines((linesRes.data || []) as POLineWithItem[]);
    } catch (error) {
      console.error('Error fetching PO:', error);
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'pending_approval' as POStatus, rejection_reason: null })
        .eq('id', po.id);
      if (error) throw error;
      toast.success('Submitted for approval');
      fetchPO();
    } catch (error) {
      toast.error('Failed to submit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'approved' as POStatus,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', po.id);
      if (poError) throw poError;

      await supabase.from('po_approvals').insert({
        po_id: po.id,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      });

      toast.success('PO approved');
      fetchPO();
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!po) return;
    const reason = window.prompt('Please enter a reason for rejection:');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'draft' as POStatus, rejection_reason: reason })
        .eq('id', po.id);
      if (error) throw error;
      toast.success('PO returned to draft for corrections');
      fetchPO();
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'sent' as POStatus,
          sent_at: new Date().toISOString(),
        })
        .eq('id', po.id);
      if (error) throw error;
      toast.success('PO marked as sent to vendor');
      fetchPO();
    } catch (error) {
      toast.error('Failed to send');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!po?.close_ready) {
      toast.error('PO is not ready to be closed. All items must be fully received and invoiced.');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'closed' as POStatus,
          closed_at: new Date().toISOString(),
        })
        .eq('id', po.id);

      if (error) throw error;
      toast.success('PO closed successfully');
      fetchPO();
    } catch (error) {
      toast.error('Failed to close PO');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!po) {
    return (
      <AppLayout>
        <div className="page-container">
          <p>Purchase Order not found</p>
          <Button variant="outline" onClick={() => navigate('/purchase-orders')}>
            Back to POs
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold">{po.po_number}</h1>
              <StatusBadge status={po.status} />
              {po.close_ready && po.status !== 'closed' && (
                <Badge variant="outline" className="border-success text-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Ready to Close
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {po.vendors?.name}
              {(po as any).requisitions?.req_number && <span className="ml-2 text-xs">• PRN: {(po as any).requisitions.req_number}</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowDocument(true)}>
              <FileText className="h-4 w-4 mr-1" /> View PO Document
            </Button>
            {po.status === 'draft' && po.created_by === user?.id && (
              <Button onClick={handleSubmitForApproval} disabled={actionLoading}>
                Submit for Approval
              </Button>
            )}
            {po.status === 'pending_approval' && canApprove && (
              <>
                <Button onClick={handleApprove} disabled={actionLoading}>
                  Approve
                </Button>
                <Button variant="outline" onClick={handleReject} disabled={actionLoading}>
                  Reject
                </Button>
              </>
            )}
            {po.status === 'approved' && canSend && (
              <Button onClick={handleSend} disabled={actionLoading}>
                Mark as Sent
              </Button>
            )}
            {po.close_ready && po.status !== 'closed' && (
              <Button onClick={handleClose}>Close PO</Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Date</span>
                <span>{new Date(po.order_date).toLocaleDateString()}</span>
              </div>
              {po.expected_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected</span>
                  <span>{new Date(po.expected_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ship To</span>
                <span>{po.locations?.name || '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{po.vendors?.name}</p>
              <p className="text-sm text-muted-foreground">{po.vendors?.email}</p>
              <p className="text-sm text-muted-foreground">{po.vendors?.phone}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₦{(po.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>₦{(po.tax_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t pt-2">
                <span>Total</span>
                <span>₦{(po.total_amount || 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{line.items?.name}</p>
                        <p className="text-xs text-muted-foreground">{line.items?.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">
                      <span className={line.qty_received >= line.quantity ? 'text-success' : ''}>
                        {line.qty_received}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={line.qty_invoiced >= line.quantity ? 'text-success' : ''}>
                        {line.qty_invoiced}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">₦{line.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">₦{line.line_total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {po.rejection_reason && po.status === 'draft' && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Returned for Corrections</p>
              <p className="text-sm text-muted-foreground mt-1">{po.rejection_reason}</p>
            </div>
          </div>
        )}

        {po.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{po.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <AttachmentPanel entityType="purchase_orders" entityId={id!} />
          </CardContent>
        </Card>

        {id && (
          <PODocumentDialog
            open={showDocument}
            onOpenChange={setShowDocument}
            poId={id}
            poStatus={po.status}
            onStatusChange={fetchPO}
          />
        )}
      </div>
    </AppLayout>
  );
}

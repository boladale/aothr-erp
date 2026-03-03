import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, X, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ConvertToPODialog } from '@/components/requisitions/ConvertToPODialog';

interface RequisitionLine {
  id: string;
  line_number: number;
  item_id: string;
  quantity: number;
  estimated_unit_cost: number;
  estimated_total: number;
  specifications: string | null;
  qty_converted: number;
  items: { code: string; name: string; unit_of_measure: string } | null;
}

interface Requisition {
  id: string;
  req_number: string;
  requester_id: string;
  department: string | null;
  status: string;
  justification: string | null;
  needed_by_date: string | null;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export default function RequisitionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [lines, setLines] = useState<RequisitionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [reqRes, linesRes] = await Promise.all([
        supabase.from('requisitions').select('*').eq('id', id!).single(),
        supabase.from('requisition_lines').select('*, items(code, name, unit_of_measure)').eq('requisition_id', id!).order('line_number'),
      ]);
      if (reqRes.error) throw reqRes.error;
      setRequisition(reqRes.data as Requisition);
      setLines((linesRes.data || []) as RequisitionLine[]);
    } catch (error) {
      toast.error('Failed to load requisition');
      navigate('/requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const { error } = await supabase.from('requisitions')
        .update({ status: 'pending_approval', submitted_at: new Date().toISOString() })
        .eq('id', id!);
      if (error) throw error;
      toast.success('Submitted for approval');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    }
  };

  const handleApprove = async () => {
    try {
      const { error } = await supabase.from('requisitions')
        .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id })
        .eq('id', id!);
      if (error) throw error;
      toast.success('Requisition approved');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      const { error } = await supabase.from('requisitions')
        .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: user?.id })
        .eq('id', id!);
      if (error) throw error;
      toast.success('Requisition rejected');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="flex items-center justify-center py-12">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!requisition) return null;

  const totalEstimate = lines.reduce((sum, l) => sum + (l.estimated_total || 0), 0);
  const canConvert = ['approved', 'partially_converted'].includes(requisition.status);
  const unconvertedLines = lines.filter(l => l.qty_converted < l.quantity);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/requisitions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader
            title={requisition.req_number}
            description={requisition.department ? `Department: ${requisition.department}` : undefined}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge status={requisition.status} />
                {requisition.status === 'draft' && requisition.requester_id === user?.id && (
                  <Button onClick={handleSubmit}><Send className="mr-2 h-4 w-4" /> Submit</Button>
                )}
                {requisition.status === 'pending_approval' && (
                  <>
                    <Button onClick={handleApprove}><Check className="mr-2 h-4 w-4" /> Approve</Button>
                    <Button variant="outline" onClick={handleReject}><X className="mr-2 h-4 w-4" /> Reject</Button>
                  </>
                )}
                {canConvert && unconvertedLines.length > 0 && (
                  <Button variant="default" onClick={() => setConvertOpen(true)}>
                    <ShoppingCart className="mr-2 h-4 w-4" /> Convert to PO
                  </Button>
                )}
              </div>
            }
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Justification</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{requisition.justification || 'None provided'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Needed By</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{requisition.needed_by_date ? new Date(requisition.needed_by_date).toLocaleDateString() : 'Not specified'}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Estimated Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₦{totalEstimate.toFixed(2)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="text-right">Est. Total</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead>Specs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_number}</TableCell>
                    <TableCell className="font-medium">{line.items?.code} - {line.items?.name}</TableCell>
                    <TableCell>{line.items?.unit_of_measure || '-'}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">₦{line.estimated_unit_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">₦{(line.estimated_total || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {line.qty_converted} / {line.quantity}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{line.specifications || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {canConvert && (
          <ConvertToPODialog
            open={convertOpen}
            onOpenChange={setConvertOpen}
            requisition={requisition}
            lines={unconvertedLines}
            onSuccess={fetchData}
          />
        )}
      </div>
    </AppLayout>
  );
}

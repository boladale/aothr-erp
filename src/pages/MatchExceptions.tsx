import { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle, Eye, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import type { InvoiceHold, MatchLine, MatchLineStatus } from '@/lib/supabase';

interface InvoiceHoldWithDetails extends InvoiceHold {
  ap_invoices: {
    id: string;
    invoice_number: string;
    vendor_id: string;
    total_amount: number | null;
    invoice_date: string;
    vendors: { id: string; name: string } | null;
  } | null;
  match_runs: {
    id: string;
    total_exceptions: number;
    match_status: string;
  } | null;
}

interface MatchLineWithDetails extends MatchLine {
  purchase_order_lines: {
    id: string;
    line_number: number;
    items: { id: string; name: string; code: string } | null;
  } | null;
}

export default function MatchExceptions() {
  const { user, hasRole } = useAuth();
  const [holds, setHolds] = useState<InvoiceHoldWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  
  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedHold, setSelectedHold] = useState<InvoiceHoldWithDetails | null>(null);
  const [matchLines, setMatchLines] = useState<MatchLineWithDetails[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  
  // Resolve dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = hasRole('admin') || hasRole('accounts_payable');

  useEffect(() => {
    fetchHolds();
  }, [filterStatus]);

  const fetchHolds = async () => {
    try {
      let query = supabase
        .from('invoice_holds')
        .select(`
          *,
          ap_invoices!inner(id, invoice_number, vendor_id, total_amount, invoice_date, vendors(id, name)),
          match_runs(id, total_exceptions, match_status)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus === 'unresolved') {
        query = query.is('resolved_at', null);
      } else if (filterStatus === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHolds((data || []) as InvoiceHoldWithDetails[]);
    } catch (error) {
      console.error('Error fetching holds:', error);
      toast.error('Failed to load exception data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchLines = async (matchRunId: string) => {
    setLoadingLines(true);
    try {
      const { data, error } = await supabase
        .from('match_lines')
        .select(`
          *,
          purchase_order_lines(id, line_number, items(id, name, code))
        `)
        .eq('match_run_id', matchRunId)
        .order('id');

      if (error) throw error;
      setMatchLines((data || []) as MatchLineWithDetails[]);
    } catch (error) {
      console.error('Error fetching match lines:', error);
    } finally {
      setLoadingLines(false);
    }
  };

  const handleViewDetails = async (hold: InvoiceHoldWithDetails) => {
    setSelectedHold(hold);
    setDetailDialogOpen(true);
    if (hold.match_run_id) {
      await fetchMatchLines(hold.match_run_id);
    }
  };

  const handleResolveClick = (hold: InvoiceHoldWithDetails) => {
    setSelectedHold(hold);
    setResolutionNotes('');
    setResolveDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedHold || !resolutionNotes.trim()) {
      toast.error('Please provide resolution notes');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoice_holds')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: resolutionNotes.trim(),
        })
        .eq('id', selectedHold.id);

      if (error) throw error;

      // Update match run status to resolved
      if (selectedHold.match_run_id) {
        await supabase
          .from('match_runs')
          .update({ match_status: 'resolved' })
          .eq('id', selectedHold.match_run_id);
      }

      toast.success('Exception resolved. Invoice can now be posted.');
      setResolveDialogOpen(false);
      setDetailDialogOpen(false);
      fetchHolds();
    } catch (error) {
      console.error('Error resolving hold:', error);
      toast.error('Failed to resolve exception');
    } finally {
      setSaving(false);
    }
  };

  const getMatchStatusBadge = (status: MatchLineStatus) => {
    const variants: Record<MatchLineStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      matched: { variant: 'default', label: 'Matched' },
      qty_exception: { variant: 'destructive', label: 'Qty Exception' },
      price_exception: { variant: 'destructive', label: 'Price Exception' },
      missing_grn: { variant: 'destructive', label: 'Missing GRN' },
      missing_invoice: { variant: 'outline', label: 'Missing Invoice' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filtered = holds.filter(h =>
    h.ap_invoices?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    h.ap_invoices?.vendors?.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.hold_reason?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (h: InvoiceHoldWithDetails) => (
        <div>
          <span className="font-medium">{h.ap_invoices?.invoice_number}</span>
          <p className="text-xs text-muted-foreground">{h.ap_invoices?.vendors?.name}</p>
        </div>
      )
    },
    {
      key: 'hold_type',
      header: 'Hold Type',
      render: (h: InvoiceHoldWithDetails) => (
        <Badge variant={h.hold_type === 'match_exception' ? 'destructive' : 'secondary'}>
          {h.hold_type.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'exceptions',
      header: 'Exceptions',
      render: (h: InvoiceHoldWithDetails) => (
        <span className="font-medium text-destructive">
          {h.match_runs?.total_exceptions || 0}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (h: InvoiceHoldWithDetails) => `$${(h.ap_invoices?.total_amount || 0).toFixed(2)}`
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (h: InvoiceHoldWithDetails) => new Date(h.created_at).toLocaleDateString()
    },
    {
      key: 'status',
      header: 'Status',
      render: (h: InvoiceHoldWithDetails) => (
        h.resolved_at ? (
          <Badge variant="outline" className="text-primary border-primary">
            <CheckCircle className="mr-1 h-3 w-3" /> Resolved
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" /> Unresolved
          </Badge>
        )
      )
    },
    {
      key: 'actions',
      header: '',
      render: (h: InvoiceHoldWithDetails) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); handleViewDetails(h); }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!h.resolved_at && canManage && (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => { e.stopPropagation(); handleResolveClick(h); }}
            >
              Resolve
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Match Exceptions"
          description="Review and resolve three-way matching exceptions"
        />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No matching exceptions found."
        />

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Match Exception Details
              </DialogTitle>
              <DialogDescription>
                Invoice {selectedHold?.ap_invoices?.invoice_number} - {selectedHold?.ap_invoices?.vendors?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Hold Type</p>
                  <p className="font-medium">{selectedHold?.hold_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Exceptions</p>
                  <p className="font-medium text-destructive">{selectedHold?.match_runs?.total_exceptions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Amount</p>
                  <p className="font-medium">${(selectedHold?.ap_invoices?.total_amount || 0).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Reason</p>
                <p>{selectedHold?.hold_reason}</p>
              </div>

              {/* Match Lines */}
              {loadingLines ? (
                <div className="text-center py-8 text-muted-foreground">Loading match details...</div>
              ) : matchLines.length > 0 ? (
                <div className="space-y-2">
                  <Label>Line-Level Matching Results</Label>
                  <div className="border rounded-lg divide-y">
                    <div className="grid grid-cols-7 gap-2 p-3 bg-muted text-sm font-medium">
                      <span>Line</span>
                      <span>Item</span>
                      <span className="text-right">PO Qty</span>
                      <span className="text-right">GRN Qty</span>
                      <span className="text-right">Inv Qty</span>
                      <span className="text-right">Price Var</span>
                      <span>Status</span>
                    </div>
                    {matchLines.map((line) => (
                      <div key={line.id} className="grid grid-cols-7 gap-2 p-3 items-center text-sm">
                        <span>#{line.purchase_order_lines?.line_number}</span>
                        <span className="truncate" title={line.purchase_order_lines?.items?.name}>
                          {line.purchase_order_lines?.items?.code}
                        </span>
                        <span className="text-right">{line.qty_po}</span>
                        <span className={`text-right ${line.qty_grn < line.qty_invoice ? 'text-destructive font-medium' : ''}`}>
                          {line.qty_grn}
                        </span>
                        <span className="text-right">{line.qty_invoice}</span>
                        <span className={`text-right ${line.variance_amt !== 0 ? 'text-destructive font-medium' : ''}`}>
                          ${line.variance_amt.toFixed(2)}
                        </span>
                        <span>{getMatchStatusBadge(line.match_status)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Resolution Info */}
              {selectedHold?.resolved_at && (
                <div className="p-4 bg-accent rounded-lg border">
                  <p className="text-sm text-muted-foreground">Resolution Notes</p>
                  <p className="font-medium">{selectedHold.resolution_notes}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Resolved on {new Date(selectedHold.resolved_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
              {!selectedHold?.resolved_at && canManage && (
                <Button onClick={() => { setDetailDialogOpen(false); handleResolveClick(selectedHold!); }}>
                  Resolve Exception
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Match Exception</DialogTitle>
              <DialogDescription>
                Override this exception to allow the invoice to be posted.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ This will allow posting an invoice that failed three-way matching.
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Ensure you have verified the discrepancy is acceptable before proceeding.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Resolution Notes *</Label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Explain why this exception is being overridden..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleResolve} disabled={saving || !resolutionNotes.trim()}>
                {saving ? 'Resolving...' : 'Resolve & Allow Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

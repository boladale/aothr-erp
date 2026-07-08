import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Trash2, Star, StarOff, FileText, Send, Users, Printer } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';

interface ReqLine {
  id: string;
  line_number: number;
  item_id: string;
  quantity: number;
  estimated_unit_cost: number;
  items: { code: string; name: string; unit_of_measure: string } | null;
}

interface BidRequest {
  id: string;
  requisition_id: string;
  status: string;
  deadline: string | null;
  notes: string | null;
  created_at: string;
}

interface BidEntry {
  id: string;
  bid_request_id: string;
  vendor_id: string;
  requisition_line_id: string;
  unit_price: number;
  quantity: number;
  notes: string | null;
  is_recommended: boolean;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface Props {
  requisitionId: string;
  lines: ReqLine[];
  onRecommendedVendor?: (vendorId: string | null) => void;
}

export function BidCollectionPanel({ requisitionId, lines, onRecommendedVendor }: Props) {
  const { user } = useAuth();
  const [bidRequest, setBidRequest] = useState<BidRequest | null>(null);
  const [entries, setEntries] = useState<BidEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invitations, setInvitations] = useState<{ id: string; vendor_id: string; status: string; payment_terms?: string | null; payment_milestones?: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSelected, setInviteSelected] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  // Add vendor bid form state
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [bidLines, setBidLines] = useState<{ requisition_line_id: string; unit_price: number; quantity: number; notes: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [requisitionId]);

  // Refetch when window regains focus (e.g. another vendor just submitted)
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [requisitionId]);

  // Realtime updates for new bid entries / invitation status changes
  useEffect(() => {
    if (!bidRequest) return;
    const channel = supabase
      .channel(`bid-${bidRequest.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisition_bid_entries', filter: `bid_request_id=eq.${bidRequest.id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_invitations', filter: `bid_request_id=eq.${bidRequest.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bidRequest?.id]);

  const fetchData = async () => {
    try {
      const [brRes, vendorRes] = await Promise.all([
        supabase.from('requisition_bid_requests').select('*').eq('requisition_id', requisitionId).maybeSingle(),
        supabase.from('vendors').select('id, code, name').eq('status', 'active').order('name'),
      ]);
      setVendors((vendorRes.data || []) as Vendor[]);

      if (brRes.data) {
        setBidRequest(brRes.data as BidRequest);
        const [entriesData, invitesData] = await Promise.all([
          supabase.from('requisition_bid_entries').select('*').eq('bid_request_id', brRes.data.id),
          (supabase.from('bid_invitations' as any).select('id, vendor_id, status, payment_terms, payment_milestones').eq('bid_request_id', brRes.data.id) as any),
        ]);
        setEntries((entriesData.data || []) as BidEntry[]);
        setInvitations((invitesData.data || []) as any);
      }
    } catch (err) {
      console.error('Failed to load bid data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBidding = async () => {
    try {
      const { data, error } = await supabase
        .from('requisition_bid_requests')
        .insert({ requisition_id: requisitionId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      setBidRequest(data as BidRequest);
      toast.success('Bid collection started');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start bid collection');
    }
  };

  const openAddVendorBid = () => {
    setSelectedVendorId('');
    setBidLines(lines.map(l => ({
      requisition_line_id: l.id,
      unit_price: l.estimated_unit_cost,
      quantity: l.quantity,
      notes: '',
    })));
    setAddDialogOpen(true);
  };

  const handleSaveVendorBid = async () => {
    if (!selectedVendorId || !bidRequest) {
      toast.error('Select a vendor');
      return;
    }
    setSaving(true);
    try {
      const rows = bidLines.map(bl => ({
        bid_request_id: bidRequest.id,
        vendor_id: selectedVendorId,
        requisition_line_id: bl.requisition_line_id,
        unit_price: bl.unit_price,
        quantity: bl.quantity,
        notes: bl.notes || null,
      }));

      const { error } = await supabase.from('requisition_bid_entries').upsert(rows, {
        onConflict: 'bid_request_id,vendor_id,requisition_line_id',
      });
      if (error) throw error;

      toast.success('Vendor bid saved');
      setAddDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save bid');
    } finally {
      setSaving(false);
    }
  };

  const openInviteDialog = () => {
    setInviteSelected(new Set());
    setInviteDialogOpen(true);
  };

  const handleSendInvites = async () => {
    const totalAfter = invitations.length + inviteSelected.size;
    if (!bidRequest || totalAfter < 3) {
      toast.error(`At least 3 vendors must be invited (currently ${totalAfter}). Please select ${3 - totalAfter} more.`);
      return;
    }
    setInviting(true);
    try {
      // Get requisition for context
      const { data: req } = await supabase
        .from('requisitions')
        .select('req_number, organization_id')
        .eq('id', requisitionId)
        .single();

      const vendorIds = Array.from(inviteSelected);
      const inviteRows = vendorIds.map(vid => ({
        bid_request_id: bidRequest.id,
        vendor_id: vid,
        invited_by: user?.id,
        status: 'invited',
      }));

      const { error: invErr } = await (supabase.from('bid_invitations' as any).insert(inviteRows as any) as any);
      if (invErr) throw invErr;

      // Notify vendor users (in-app)
      const { data: vUsers } = await (supabase
        .from('vendor_users' as any)
        .select('user_id, vendor_id')
        .in('vendor_id', vendorIds)
        .eq('is_active', true) as any);

      if (vUsers && vUsers.length > 0) {
        const notifs = (vUsers as any[]).map(vu => ({
          user_id: vu.user_id,
          entity_type: 'bid_request',
          entity_id: bidRequest.id,
          notification_type: 'rfq_invitation',
          title: 'New Quote Request',
          message: `You've been invited to submit a quote for ${req?.req_number || 'a requisition'}.`,
          organization_id: req?.organization_id,
        }));
        await supabase.from('notifications').upsert(notifs, {
          onConflict: 'user_id,entity_type,entity_id,notification_type',
        });
      }

      toast.success(`Invited ${vendorIds.length} vendor(s)`);
      setInviteDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setInviting(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const { data: req } = await supabase
        .from('requisitions')
        .select('req_number, justification, needed_by_date, organization_id')
        .eq('id', requisitionId)
        .single();

      let orgName = 'Organization';
      let orgLogo: string | null = null;
      let orgAddress = '';
      if (req?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name, logo_url, address')
          .eq('id', req.organization_id)
          .single();
        if (org) {
          orgName = org.name || orgName;
          orgLogo = (org as any).logo_url || null;
          orgAddress = (org as any).address || '';
        }
      }

      const deadlineStr = bidRequest?.deadline
        ? new Date(bidRequest.deadline).toLocaleDateString()
        : 'As soon as possible';
      const requiredBy = req?.needed_by_date ? new Date(req.needed_by_date).toLocaleDateString() : '-';
      const today = new Date().toLocaleDateString();

      const rowsHtml = lines.map((l, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${l.items?.code || ''}</td>
          <td>${l.items?.name || ''}</td>
          <td style="text-align:center;">${l.quantity}</td>
          <td style="text-align:center;">${l.items?.unit_of_measure || ''}</td>
          <td style="min-width:120px;"></td>
          <td style="min-width:120px;"></td>
        </tr>
      `).join('');

      const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>RFQ ${req?.req_number || ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; padding: 24px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; }
  .org { font-size: 18px; font-weight: bold; color: #1e3a8a; }
  .muted { color: #555; font-size: 11px; }
  h1 { font-size: 20px; margin: 12px 0; text-align: center; color: #1e3a8a; letter-spacing: 1px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0 20px; }
  .meta div { padding: 4px 0; }
  .meta b { display: inline-block; min-width: 120px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 6px 8px; font-size: 12px; }
  th { background: #eef2ff; text-align: left; }
  .notes { margin-top: 20px; font-size: 11px; line-height: 1.5; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign div { width: 45%; border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 11px; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .btn { background:#1e3a8a; color:#fff; border:0; padding:8px 16px; border-radius:4px; cursor:pointer; }
</style>
</head><body>
  <div class="noprint" style="text-align:right; margin-bottom:12px;">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      ${orgLogo ? `<img src="${orgLogo}" style="max-height:60px; margin-bottom:6px;"/>` : ''}
      <div class="org">${orgName}</div>
      <div class="muted">${orgAddress}</div>
    </div>
    <div style="text-align:right;">
      <div class="muted">Date: ${today}</div>
      <div class="muted">RFQ Ref: ${req?.req_number || '-'}</div>
    </div>
  </div>

  <h1>REQUEST FOR QUOTATION</h1>

  <div class="meta">
    <div><b>Requisition No:</b> ${req?.req_number || '-'}</div>
    <div><b>Quote Deadline:</b> ${deadlineStr}</div>
    <div><b>Required By:</b> ${requiredBy}</div>
    <div><b>Description:</b> ${req?.justification || '-'}</div>
  </div>

  <p>Dear Vendor,</p>
  <p>You are invited to submit your best quotation for the items listed below. Please fill in your unit price and total, sign, and return this document by the quote deadline.</p>

  <table>
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>Item Code</th>
        <th>Description</th>
        <th style="width:60px;">Qty</th>
        <th style="width:60px;">UoM</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="notes">
    <p><b>Instructions to Vendor:</b></p>
    <ol>
      <li>Quote all prices in your local currency inclusive of applicable taxes.</li>
      <li>State payment terms, delivery lead time, and validity period of your quotation.</li>
      <li>Submit your response on or before the quote deadline.</li>
    </ol>
    <p><b>Vendor Name: </b> ______________________________ &nbsp;&nbsp;
       <b>Payment Terms: </b> ______________________________</p>
    <p><b>Delivery Lead Time: </b> _____________________ &nbsp;&nbsp;
       <b>Quote Validity: </b> _____________________</p>
  </div>

  <div class="sign">
    <div>Authorized (Buyer)</div>
    <div>Vendor Signature & Stamp</div>
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

      const w = window.open('', '_blank');
      if (!w) {
        toast.error('Please allow pop-ups to download the PDF');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    }
  };

  const handleRecommend = async (vendorId: string) => {
    if (!bidRequest) return;
    try {
      // Clear all recommendations first
      await supabase
        .from('requisition_bid_entries')
        .update({ is_recommended: false })
        .eq('bid_request_id', bidRequest.id);
      // Set this vendor as recommended
      await supabase
        .from('requisition_bid_entries')
        .update({ is_recommended: true })
        .eq('bid_request_id', bidRequest.id)
        .eq('vendor_id', vendorId);
      
      toast.success('Vendor recommended');
      onRecommendedVendor?.(vendorId);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to recommend');
    }
  };

  const handleRemoveVendorBids = async (vendorId: string) => {
    if (!bidRequest) return;
    try {
      const { error } = await supabase
        .from('requisition_bid_entries')
        .delete()
        .eq('bid_request_id', bidRequest.id)
        .eq('vendor_id', vendorId);
      if (error) throw error;
      toast.success('Vendor bid removed');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const handleCloseBidding = async () => {
    if (!bidRequest) return;
    try {
      const { error } = await supabase
        .from('requisition_bid_requests')
        .update({ status: 'closed' })
        .eq('id', bidRequest.id);
      if (error) throw error;
      toast.success('Bidding closed');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close bidding');
    }
  };

  // Group entries by vendor
  const vendorBids = useMemo(() => {
    const grouped = new Map<string, BidEntry[]>();
    entries.forEach(e => {
      const list = grouped.get(e.vendor_id) || [];
      list.push(e);
      grouped.set(e.vendor_id, list);
    });
    return grouped;
  }, [entries]);

  const vendorTotals = useMemo(() => {
    const totals = new Map<string, number>();
    vendorBids.forEach((bids, vendorId) => {
      totals.set(vendorId, bids.reduce((sum, b) => sum + b.unit_price * b.quantity, 0));
    });
    return totals;
  }, [vendorBids]);

  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.name || 'Unknown';
  const getVendorCode = (id: string) => vendors.find(v => v.id === id)?.code || '';
  const isRecommended = (vendorId: string) => entries.some(e => e.vendor_id === vendorId && e.is_recommended);

  // Vendors already in the bids
  const biddingVendorIds = Array.from(vendorBids.keys());
  const availableVendors = vendors.filter(v => !biddingVendorIds.includes(v.id));

  const lowestTotal = Math.min(...Array.from(vendorTotals.values()));

  if (loading) return null;

  // No bid request yet - show start button
  if (!bidRequest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Vendor Bid Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Collect and compare vendor quotations for this requisition before converting to a Purchase Order.
          </p>
          <Button onClick={handleStartBidding}>
            <Plus className="mr-2 h-4 w-4" /> Start Bid Collection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Vendor Bids
            <Badge variant={bidRequest.status === 'open' ? 'default' : 'secondary'}>
              {bidRequest.status}
            </Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
              <Printer className="mr-1 h-3 w-3" /> Print / Download RFQ PDF
            </Button>
            {bidRequest.status === 'open' && (
              <>
                <Button size="sm" variant="outline" onClick={openInviteDialog}>
                  <Send className="mr-1 h-3 w-3" /> Invite 3 Vendors
                </Button>
                <Button size="sm" variant="outline" onClick={openAddVendorBid}>
                  <Plus className="mr-1 h-3 w-3" /> Add Vendor Bid
                </Button>
                {vendorBids.size >= 2 && (
                  <Button size="sm" variant="outline" onClick={handleCloseBidding}>
                    Close Bidding
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invitations.length > 0 && (
            <div className="mb-4 p-3 rounded-md bg-muted/40 border">
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" /> Invited Vendors ({invitations.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {invitations.map(inv => {
                  const v = vendors.find(x => x.id === inv.vendor_id);
                  const hasQuoted = entries.some(e => e.vendor_id === inv.vendor_id);
                  return (
                    <Badge key={inv.id} variant={hasQuoted ? 'default' : 'secondary'} className="text-xs">
                      {v?.name || 'Vendor'} · {hasQuoted ? 'Quoted' : 'Awaiting'}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          {vendorBids.size === 0 ? (
            <p className="text-sm text-muted-foreground">No vendor bids yet. Add vendor quotations to compare.</p>
          ) : (
            <div className="space-y-4">
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Item</TableHead>
                      <TableHead className="sticky left-0 bg-background z-10 text-right">Est. Cost</TableHead>
                      {biddingVendorIds.map(vid => (
                        <TableHead key={vid} className="text-center min-w-[140px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-medium">{getVendorCode(vid)}</span>
                            <span className="text-xs text-muted-foreground">{getVendorName(vid)}</span>
                            {isRecommended(vid) && (
                              <Badge variant="default" className="text-xs">★ Recommended</Badge>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map(line => (
                      <TableRow key={line.id}>
                        <TableCell className="sticky left-0 bg-background font-medium text-sm">
                          {line.items?.code} - {line.items?.name}
                          <span className="text-xs text-muted-foreground ml-1">×{line.quantity}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(line.estimated_unit_cost)}
                        </TableCell>
                        {biddingVendorIds.map(vid => {
                          const entry = entries.find(e => e.vendor_id === vid && e.requisition_line_id === line.id);
                          const isLowest = entry && biddingVendorIds.length > 1 &&
                            entry.unit_price === Math.min(...entries.filter(e => e.requisition_line_id === line.id).map(e => e.unit_price));
                          return (
                            <TableCell key={vid} className={`text-center ${isLowest ? 'text-green-600 font-semibold' : ''}`}>
                              {entry ? formatCurrency(entry.unit_price) : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-bold border-t-2">
                      <TableCell className="sticky left-0 bg-background">Total</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(lines.reduce((s, l) => s + l.estimated_unit_cost * l.quantity, 0))}
                      </TableCell>
                      {biddingVendorIds.map(vid => {
                        const total = vendorTotals.get(vid) || 0;
                        const isLowest = total === lowestTotal && biddingVendorIds.length > 1;
                        return (
                          <TableCell key={vid} className={`text-center ${isLowest ? 'text-green-600' : ''}`}>
                            {formatCurrency(total)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Action buttons per vendor */}
              <div className="flex flex-wrap gap-2">
                {biddingVendorIds.map(vid => (
                  <div key={vid} className="flex items-center gap-1 border rounded-lg px-3 py-2">
                    <span className="text-sm font-medium mr-2">{getVendorCode(vid)} - {getVendorName(vid)}</span>
                    {!isRecommended(vid) ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleRecommend(vid)}>
                        <Star className="mr-1 h-3 w-3" /> Recommend
                      </Button>
                    ) : (
                      <Badge variant="default" className="text-xs">★ Recommended</Badge>
                    )}
                    {bidRequest.status === 'open' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleRemoveVendorBids(vid)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Vendor Bid Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Vendor Quotation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {availableVendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bidLines.map((bl, idx) => {
                  const line = lines.find(l => l.id === bl.requisition_line_id);
                  return (
                    <TableRow key={bl.requisition_line_id}>
                      <TableCell className="text-sm">{line?.items?.code} - {line?.items?.name}</TableCell>
                      <TableCell className="text-right">{bl.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28 text-right"
                          value={bl.unit_price}
                          onChange={e => {
                            const updated = [...bidLines];
                            updated[idx].unit_price = parseFloat(e.target.value) || 0;
                            setBidLines(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency((bl.unit_price * bl.quantity))}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-32"
                          placeholder="Notes"
                          value={bl.notes}
                          onChange={e => {
                            const updated = [...bidLines];
                            updated[idx].notes = e.target.value;
                            setBidLines(updated);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="text-right font-semibold">
              Total: {formatCurrency(bidLines.reduce((s, bl) => s + bl.unit_price * bl.quantity, 0))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendorBid} disabled={saving}>
              {saving ? 'Saving...' : 'Save Bid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Vendors Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Vendors to Submit Quotes</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Policy requires at least <b>3 vendors</b> to be invited per requisition. Selected vendors will be notified and can submit quotes via the Vendor Portal.
              {invitations.length > 0 && ` Already invited: ${invitations.length}.`}
            </p>
            <div className="border rounded-md divide-y max-h-[50vh] overflow-y-auto">
              {availableVendors.filter(v => !invitations.some(i => i.vendor_id === v.id)).map(v => (
                <label key={v.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={inviteSelected.has(v.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(inviteSelected);
                      if (checked) next.add(v.id); else next.delete(v.id);
                      setInviteSelected(next);
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.code}</div>
                  </div>
                </label>
              ))}
              {availableVendors.filter(v => !invitations.some(i => i.vendor_id === v.id)).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">No more vendors available to invite.</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendInvites} disabled={inviting || inviteSelected.size === 0}>
              <Send className="mr-1 h-4 w-4" /> {inviting ? 'Sending...' : `Invite ${inviteSelected.size || ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

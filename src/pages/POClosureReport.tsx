import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { PurchaseOrder, Vendor, PurchaseOrderLine, Item } from '@/lib/supabase';

interface POWithDetails extends PurchaseOrder {
  vendors: Vendor | null;
  purchase_order_lines: POLineWithItem[];
}

interface POLineWithItem extends PurchaseOrderLine {
  items: Item | null;
}

export default function POClosureReport() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<POWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [readyFilter, setReadyFilter] = useState<string>('all');
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, vendors(*), purchase_order_lines(*, items(*))')
        .in('status', ['sent', 'partially_received', 'fully_received', 'closed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as POWithDetails[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = orders.filter(o => {
    if (search && !o.po_number.toLowerCase().includes(search.toLowerCase()) &&
        !o.vendors?.name?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (readyFilter === 'ready' && !o.close_ready) return false;
    if (readyFilter === 'not_ready' && o.close_ready) return false;
    return true;
  });

  const summary = {
    total: filtered.length,
    ready: filtered.filter(o => o.close_ready && o.status !== 'closed').length,
    closed: filtered.filter(o => o.status === 'closed').length,
    pending: filtered.filter(o => !o.close_ready && o.status !== 'closed').length,
  };

  const calculateTotals = (po: POWithDetails) => {
    const lines = po.purchase_order_lines || [];
    return {
      ordered: lines.reduce((sum, l) => sum + l.quantity, 0),
      received: lines.reduce((sum, l) => sum + l.qty_received, 0),
      invoiced: lines.reduce((sum, l) => sum + l.qty_invoiced, 0),
      mismatches: lines.filter(l => l.qty_received < l.quantity || l.qty_invoiced < l.quantity).length,
    };
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="PO Closure Readiness Report"
          description="Review purchase orders ready for closure"
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-sm text-muted-foreground">Total POs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-success/10 p-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.ready}</p>
                  <p className="text-sm text-muted-foreground">Ready to Close</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.closed}</p>
                  <p className="text-sm text-muted-foreground">Closed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-warning/10 p-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search POs or vendors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partially_received">Partial</SelectItem>
              <SelectItem value="fully_received">Received</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={readyFilter} onValueChange={setReadyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Readiness" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ready">Ready Only</SelectItem>
              <SelectItem value="not_ready">Not Ready</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Report Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-center">Mismatches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ready</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No purchase orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(po => {
                    const totals = calculateTotals(po);
                    const isExpanded = expandedPO === po.id;
                    
                    return (
                      <>
                        <TableRow 
                          key={po.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                        >
                          <TableCell className="font-medium">{po.po_number}</TableCell>
                          <TableCell>{po.vendors?.name}</TableCell>
                          <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{totals.ordered}</TableCell>
                          <TableCell className="text-right">
                            <span className={totals.received >= totals.ordered ? 'text-success' : ''}>
                              {totals.received}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={totals.invoiced >= totals.ordered ? 'text-success' : ''}>
                              {totals.invoiced}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {totals.mismatches > 0 ? (
                              <Badge variant="destructive">{totals.mismatches}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={po.status} />
                          </TableCell>
                          <TableCell>
                            {po.close_ready ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-warning" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${po.id}`); }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Line Details */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <div className="text-sm">
                                <p className="font-medium mb-2">Line Item Details</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>#</TableHead>
                                      <TableHead>Item</TableHead>
                                      <TableHead className="text-right">Ordered</TableHead>
                                      <TableHead className="text-right">Received</TableHead>
                                      <TableHead className="text-right">Invoiced</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {po.purchase_order_lines.map(line => {
                                      const receivedMatch = line.qty_received >= line.quantity;
                                      const invoicedMatch = line.qty_invoiced >= line.quantity;
                                      
                                      return (
                                        <TableRow key={line.id}>
                                          <TableCell>{line.line_number}</TableCell>
                                          <TableCell>
                                            {line.items?.name} ({line.items?.code})
                                          </TableCell>
                                          <TableCell className="text-right">{line.quantity}</TableCell>
                                          <TableCell className="text-right">
                                            <span className={receivedMatch ? 'text-success' : 'text-warning'}>
                                              {line.qty_received}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span className={invoicedMatch ? 'text-success' : 'text-warning'}>
                                              {line.qty_invoiced}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            {receivedMatch && invoicedMatch ? (
                                              <Badge variant="outline" className="border-success text-success">Complete</Badge>
                                            ) : (
                                              <Badge variant="outline" className="border-warning text-warning">Pending</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

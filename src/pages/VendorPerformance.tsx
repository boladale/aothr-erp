import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { MetricCard } from '@/components/ui/metric-card';
import { Building2, TrendingUp, Star, Truck, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface VendorPerf {
  id: string;
  code: string;
  name: string;
  status: string;
  service_categories: string[] | null;
  project_size_capacity: string | null;
  totalPOValue: number;
  totalPOs: number;
  completedPOs: number;
  avgRating: number;
  avgDeliveryRating: number;
  avgQualityRating: number;
  ratingCount: number;
  onTimeDeliveries: number;
  totalDeliveries: number;
}

const COLORS = ['hsl(217, 91%, 45%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(199, 89%, 48%)'];

export default function VendorPerformance() {
  const [vendors, setVendors] = useState<VendorPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      // Get all active vendors
      const { data: vendorData } = await supabase.from('vendors').select('*').eq('status', 'active');
      const vendorList = (vendorData || []) as { id: string; code: string; name: string; status: string; service_categories: string[] | null; project_size_capacity: string | null }[];

      // Get all POs
      const { data: poData } = await supabase.from('purchase_orders').select('id, vendor_id, status, total_amount, expected_date');
      const pos = (poData || []) as { id: string; vendor_id: string; status: string; total_amount: number | null; expected_date: string | null }[];

      // Get all GRNs (for delivery tracking)
      const { data: grnData } = await supabase.from('goods_receipts').select('id, po_id, receipt_date, status, posted_at');
      const grns = (grnData || []) as { id: string; po_id: string; receipt_date: string; status: string; posted_at: string | null }[];

      // Get ratings
      const { data: ratingsData } = await supabase.from('vendor_ratings').select('*');
      const ratings = (ratingsData || []) as { vendor_id: string; rating: number; delivery_rating: number | null; quality_rating: number | null }[];

      // Build performance data
      const perfData: VendorPerf[] = vendorList.map(v => {
        const vendorPOs = pos.filter(p => p.vendor_id === v.id);
        const totalPOValue = vendorPOs.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const completedPOs = vendorPOs.filter(p => ['fully_received', 'closed'].includes(p.status)).length;

        // Delivery performance
        const vendorGRNs = grns.filter(g => {
          const po = vendorPOs.find(p => p.id === g.po_id);
          return !!po && g.status === 'posted';
        });

        let onTimeDeliveries = 0;
        vendorGRNs.forEach(g => {
          const po = pos.find(p => p.id === g.po_id);
          if (po?.expected_date && g.receipt_date) {
            if (new Date(g.receipt_date) <= new Date(po.expected_date)) {
              onTimeDeliveries++;
            }
          }
        });

        // Ratings
        const vendorRatings = ratings.filter(r => r.vendor_id === v.id);
        const avgRating = vendorRatings.length > 0
          ? vendorRatings.reduce((s, r) => s + r.rating, 0) / vendorRatings.length
          : 0;
        const avgDeliveryRating = vendorRatings.filter(r => r.delivery_rating).length > 0
          ? vendorRatings.reduce((s, r) => s + (r.delivery_rating || 0), 0) / vendorRatings.filter(r => r.delivery_rating).length
          : 0;
        const avgQualityRating = vendorRatings.filter(r => r.quality_rating).length > 0
          ? vendorRatings.reduce((s, r) => s + (r.quality_rating || 0), 0) / vendorRatings.filter(r => r.quality_rating).length
          : 0;

        return {
          id: v.id,
          code: v.code,
          name: v.name,
          status: v.status,
          service_categories: v.service_categories,
          project_size_capacity: v.project_size_capacity,
          totalPOValue,
          totalPOs: vendorPOs.length,
          completedPOs,
          avgRating,
          avgDeliveryRating,
          avgQualityRating,
          ratingCount: vendorRatings.length,
          onTimeDeliveries,
          totalDeliveries: vendorGRNs.length,
        };
      });

      // Sort by total PO value descending
      perfData.sort((a, b) => b.totalPOValue - a.totalPOValue);
      setVendors(perfData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load vendor performance data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalVendors = vendors.length;
  const totalWorkValue = vendors.reduce((s, v) => s + v.totalPOValue, 0);
  const avgOverallRating = vendors.filter(v => v.ratingCount > 0).length > 0
    ? vendors.filter(v => v.ratingCount > 0).reduce((s, v) => s + v.avgRating, 0) / vendors.filter(v => v.ratingCount > 0).length
    : 0;
  const avgOnTime = vendors.filter(v => v.totalDeliveries > 0).length > 0
    ? vendors.filter(v => v.totalDeliveries > 0).reduce((s, v) => s + (v.onTimeDeliveries / v.totalDeliveries) * 100, 0) / vendors.filter(v => v.totalDeliveries > 0).length
    : 0;

  // Chart data - top 5 vendors by value
  const topVendors = vendors.slice(0, 5).map(v => ({
    name: v.name.length > 15 ? v.name.substring(0, 15) + '...' : v.name,
    value: v.totalPOValue,
  }));

  // Rating distribution
  const ratingDist = [
    { name: '5 Stars', value: vendors.filter(v => v.avgRating >= 4.5).length },
    { name: '4 Stars', value: vendors.filter(v => v.avgRating >= 3.5 && v.avgRating < 4.5).length },
    { name: '3 Stars', value: vendors.filter(v => v.avgRating >= 2.5 && v.avgRating < 3.5).length },
    { name: 'Below 3', value: vendors.filter(v => v.avgRating > 0 && v.avgRating < 2.5).length },
    { name: 'Unrated', value: vendors.filter(v => v.ratingCount === 0).length },
  ].filter(d => d.value > 0);

  const renderStars = (rating: number) => {
    if (rating === 0) return <span className="text-muted-foreground text-sm">No ratings</span>;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <Star key={s} className={`h-4 w-4 ${s <= Math.round(rating) ? 'text-warning fill-warning' : 'text-muted'}`} />
        ))}
        <span className="text-sm ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Vendor Performance Dashboard"
          description="Monitor vendor performance metrics, ratings, and delivery track records"
        />

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard title="Active Vendors" value={totalVendors} icon={Building2} />
          <MetricCard title="Total Work Value" value={formatCurrency(totalWorkValue)} icon={TrendingUp} />
          <MetricCard title="Avg Rating" value={avgOverallRating > 0 ? `${avgOverallRating.toFixed(1)}/5` : 'N/A'} icon={Star} />
          <MetricCard title="On-Time Delivery" value={avgOnTime > 0 ? `${avgOnTime.toFixed(0)}%` : 'N/A'} icon={Truck} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>Top Vendors by Work Value</CardTitle></CardHeader>
            <CardContent>
              {topVendors.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topVendors}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="hsl(217, 91%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rating Distribution</CardTitle></CardHeader>
            <CardContent>
              {ratingDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={ratingDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {ratingDist.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {/* Vendor Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Vendor</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Total POs</TableHead>
                  <TableHead>Work Value</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>On-Time Rate</TableHead>
                  <TableHead>Overall Rating</TableHead>
                  <TableHead>Delivery Rating</TableHead>
                  <TableHead>Quality Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No vendors found</TableCell></TableRow>
                ) : (
                  filtered.map(v => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(v.service_categories || []).slice(0, 2).map(c => (
                            <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{v.totalPOs}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(v.totalPOValue)}</TableCell>
                      <TableCell>{v.completedPOs}/{v.totalPOs}</TableCell>
                      <TableCell>
                        {v.totalDeliveries > 0 ? (
                          <Badge variant={v.onTimeDeliveries / v.totalDeliveries >= 0.8 ? 'default' : 'destructive'}>
                            {((v.onTimeDeliveries / v.totalDeliveries) * 100).toFixed(0)}%
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{renderStars(v.avgRating)}</TableCell>
                      <TableCell>{renderStars(v.avgDeliveryRating)}</TableCell>
                      <TableCell>{renderStars(v.avgQualityRating)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

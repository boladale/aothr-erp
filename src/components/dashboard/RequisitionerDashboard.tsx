import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';

export function RequisitionerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalReqs: 0,
    draftReqs: 0,
    pendingReqs: 0,
    approvedReqs: 0,
    rejectedReqs: 0,
  });
  const [myRequisitions, setMyRequisitions] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const userId = user!.id;
      const [total, draft, pending, approved, rejected, recent] = await Promise.all([
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('requester_id', userId),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'draft'),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'pending_approval'),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'approved'),
        supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'rejected'),
        supabase.from('requisitions').select('id, req_number, status, department, needed_by_date, created_at').eq('requester_id', userId).order('created_at', { ascending: false }).limit(8),
      ]);

      setMetrics({
        totalReqs: total.count || 0,
        draftReqs: draft.count || 0,
        pendingReqs: pending.count || 0,
        approvedReqs: approved.count || 0,
        rejectedReqs: rejected.count || 0,
      });
      setMyRequisitions(recent.data || []);
    } catch (error) {
      console.error('Error fetching requisitioner dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">My Requisitions</h2>
        <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">My Requisitions</h2>

      <div className="card-grid">
        <MetricCard title="Total Requisitions" value={metrics.totalReqs} icon={ClipboardList} />
        <MetricCard title="Drafts" value={metrics.draftReqs} icon={ClipboardList} />
        <MetricCard title="Pending Approval" value={metrics.pendingReqs} icon={Clock} />
        <MetricCard title="Approved" value={metrics.approvedReqs} icon={CheckCircle2} />
      </div>

      {metrics.rejectedReqs > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium">{metrics.rejectedReqs} requisition(s) rejected — review and resubmit</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/requisitions')}>View</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">My Recent Requisitions</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/requisitions')}>
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {myRequisitions.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No requisitions yet. Create your first one!</p>
          ) : (
            <div className="space-y-3">
              {myRequisitions.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/requisitions/${req.id}`)}>
                  <div>
                    <p className="text-sm font-medium">{req.req_number}</p>
                    <p className="text-xs text-muted-foreground">{req.department || 'No department'} • {req.needed_by_date || 'No date'}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, Activity, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalRoles: 0,
    recentAuditLogs: 0,
    activeApprovalRules: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [users, roles, auditCount, approvalRules, logs] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.from('approval_rules').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('audit_logs').select('id, entity_type, action, created_at').order('created_at', { ascending: false }).limit(8),
      ]);

      setMetrics({
        totalUsers: users.count || 0,
        totalRoles: roles.count || 0,
        recentAuditLogs: auditCount.count || 0,
        activeApprovalRules: approvalRules.count || 0,
      });
      setRecentLogs(logs.data || []);
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Administration</h2>
        <div className="card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Administration</h2>

      <div className="card-grid">
        <MetricCard title="Total Users" value={metrics.totalUsers} icon={Users} />
        <MetricCard title="Role Assignments" value={metrics.totalRoles} icon={Shield} />
        <MetricCard title="Approval Rules" value={metrics.activeApprovalRules} icon={Shield} />
        <MetricCard title="Audit Log Entries" value={metrics.recentAuditLogs} icon={Activity} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Audit Activity</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No audit logs yet</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{log.entity_type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

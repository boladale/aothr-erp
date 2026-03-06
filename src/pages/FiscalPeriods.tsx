import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Lock, Unlock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function FiscalPeriods() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPeriods(); }, []);

  const fetchPeriods = async () => {
    const { data } = await supabase.from('gl_fiscal_periods').select('*').order('fiscal_year').order('period_number');
    setPeriods(data || []);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('gl_fiscal_periods').update({ 
      status: newStatus as any,
      ...(newStatus === 'closed' ? { closed_at: new Date().toISOString() } : {}),
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Period ${newStatus}`);
    fetchPeriods();
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader title="Fiscal Periods" description="Manage accounting periods for the general ledger" />
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Start</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">End</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periods.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{p.period_name}</td>
                      <td className="px-4 py-3 text-sm">{p.fiscal_year}</td>
                      <td className="px-4 py-3 text-sm">{p.start_date}</td>
                      <td className="px-4 py-3 text-sm">{p.end_date}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {p.status === 'open' && (
                            <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'closed')}>
                              <Lock className="h-3 w-3 mr-1" /> Close
                            </Button>
                          )}
                          {p.status === 'closed' && (
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'open')}>
                                <Unlock className="h-3 w-3 mr-1" /> Reopen
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'locked')}>
                                <Lock className="h-3 w-3 mr-1" /> Lock
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

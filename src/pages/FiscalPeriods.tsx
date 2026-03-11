import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Lock, Unlock, BookOpen, CalendarCheck, ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GeneratePeriodsDialog } from '@/components/fiscal/GeneratePeriodsDialog';

export default function FiscalPeriods() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // Year-end close dialog
  const [yeCloseOpen, setYeCloseOpen] = useState(false);
  const [yeYear, setYeYear] = useState<string>('');

  // Carry-forward dialog
  const [cfOpen, setCfOpen] = useState(false);
  const [cfFromYear, setCfFromYear] = useState<string>('');
  const [cfToYear, setCfToYear] = useState<string>('');

  // Generate periods dialog
  const [genOpen, setGenOpen] = useState(false);
  useEffect(() => { fetchPeriods(); }, []);

  const fetchPeriods = async () => {
    const { data } = await supabase.from('gl_fiscal_periods').select('*').order('fiscal_year').order('period_number');
    setPeriods(data || []);
    setLoading(false);
  };

  const fiscalYears = useMemo(() => {
    const years = [...new Set(periods.map(p => p.fiscal_year))];
    return years.sort();
  }, [periods]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('gl_fiscal_periods').update({
      status: newStatus as any,
      ...(newStatus === 'closed' ? { closed_at: new Date().toISOString() } : {}),
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Period ${newStatus}`);
    fetchPeriods();
  };

  const handlePeriodEndSummary = async (periodId: string, periodName: string) => {
    setRunningAction(periodId);
    try {
      const { data, error } = await supabase.rpc('gl_period_end_summary', { p_period_id: periodId });
      if (error) throw error;
      if (data) {
        toast.success(`Period-end summary created for ${periodName}`);
      } else {
        toast.info('No activity found for this period — no summary entry created.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to run period-end summary');
    } finally {
      setRunningAction(null);
    }
  };

  const handleYearEndClose = async () => {
    if (!yeYear) return;
    setRunningAction('ye-close');
    try {
      const { data, error } = await supabase.rpc('gl_year_end_close', { p_fiscal_year: parseInt(yeYear) });
      if (error) throw error;
      if (data) {
        toast.success(`Year-end close completed for FY${yeYear}. Revenue & Expense zeroed into Retained Earnings.`);
      } else {
        toast.info('No revenue/expense balances to close for this year.');
      }
      setYeCloseOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to run year-end close');
    } finally {
      setRunningAction(null);
    }
  };

  const handleCarryForward = async () => {
    if (!cfFromYear || !cfToYear) return;
    setRunningAction('cf');
    try {
      const { data, error } = await supabase.rpc('gl_carry_forward_balances', {
        p_from_year: parseInt(cfFromYear),
        p_to_year: parseInt(cfToYear),
      });
      if (error) throw error;
      if (data) {
        toast.success(`Opening balances created for FY${cfToYear} from FY${cfFromYear}.`);
      } else {
        toast.info('No balance sheet balances to carry forward.');
      }
      setCfOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to carry forward balances');
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Fiscal Periods"
          description="Manage accounting periods, year-end close, and opening balances"
          actions={isAdmin ? (
            <div className="flex gap-2">
              <Button onClick={() => setGenOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Generate Periods
              </Button>
              <Button variant="outline" onClick={() => setYeCloseOpen(true)}>
                <CalendarCheck className="h-4 w-4 mr-1" /> Year-End Close
              </Button>
              <Button variant="outline" onClick={() => setCfOpen(true)}>
                <ArrowRight className="h-4 w-4 mr-1" /> Carry Forward
              </Button>
            </div>
          ) : undefined}
        />

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
                          <div className="flex gap-2 justify-end">
                            {p.status === 'open' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={runningAction === p.id}
                                  onClick={() => handlePeriodEndSummary(p.id, p.period_name)}
                                >
                                  <BookOpen className="h-3 w-3 mr-1" /> Summary
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'closed')}>
                                  <Lock className="h-3 w-3 mr-1" /> Close
                                </Button>
                              </>
                            )}
                            {p.status === 'closed' && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'open')}>
                                  <Unlock className="h-3 w-3 mr-1" /> Reopen
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, 'locked')}>
                                  <Lock className="h-3 w-3 mr-1" /> Lock
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Year-End Close Dialog */}
      <Dialog open={yeCloseOpen} onOpenChange={setYeCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Year-End Close</DialogTitle>
            <DialogDescription>
              This will zero out all Revenue and Expense accounts for the selected fiscal year and transfer the net income/loss to Retained Earnings (3200).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground">Fiscal Year</label>
            <Select value={yeYear} onValueChange={setYeYear}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select fiscal year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYeCloseOpen(false)}>Cancel</Button>
            <Button onClick={handleYearEndClose} disabled={!yeYear || runningAction === 'ye-close'}>
              {runningAction === 'ye-close' ? 'Processing...' : 'Run Year-End Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carry Forward Dialog */}
      <Dialog open={cfOpen} onOpenChange={setCfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carry Forward Opening Balances</DialogTitle>
            <DialogDescription>
              Creates opening balance journal entries for the new fiscal year using the closing balances of all Balance Sheet accounts (Assets, Liabilities, Equity) from the prior year. Year-end close must be completed first.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">From Year</label>
              <Select value={cfFromYear} onValueChange={setCfFromYear}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Source year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">To Year</label>
              <Select value={cfToYear} onValueChange={setCfToYear}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Target year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCfOpen(false)}>Cancel</Button>
            <Button onClick={handleCarryForward} disabled={!cfFromYear || !cfToYear || runningAction === 'cf'}>
              {runningAction === 'cf' ? 'Processing...' : 'Create Opening Balances'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Generate Periods Dialog */}
      <GeneratePeriodsDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        existingYears={fiscalYears}
        onGenerated={fetchPeriods}
      />
    </AppLayout>
  );
}

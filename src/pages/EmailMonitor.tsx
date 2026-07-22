import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Mail, RefreshCw, CheckCircle2, XCircle, ShieldOff, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

type Row = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
};

const RANGES = [
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 7 days', hours: 24 * 7 },
  { label: 'Last 30 days', hours: 24 * 30 },
];

export default function EmailMonitor() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [rangeHours, setRangeHours] = useState<number>(24 * 7);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsAdmin((data || []).some((r: any) => r.role === 'admin'));
    })();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - rangeHours * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from('email_send_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, rangeHours]);

  // Dedupe by message_id — keep latest row per message
  const latestByMessage = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const key = r.message_id || r.id;
      if (!map.has(key)) map.set(key, r); // rows are already DESC by created_at
    }
    return Array.from(map.values());
  }, [rows]);

  const templates = useMemo(
    () => Array.from(new Set(latestByMessage.map(r => r.template_name).filter(Boolean))).sort() as string[],
    [latestByMessage]
  );

  const filtered = useMemo(() => {
    return latestByMessage.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (templateFilter !== 'all' && r.template_name !== templateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.recipient_email?.toLowerCase().includes(q) &&
          !r.template_name?.toLowerCase().includes(q) &&
          !r.error_message?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [latestByMessage, statusFilter, templateFilter, search]);

  const stats = useMemo(() => {
    const s = { total: 0, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of latestByMessage) {
      s.total++;
      if (r.status === 'sent') s.sent++;
      else if (r.status === 'dlq' || r.status === 'failed' || r.status === 'bounced') s.failed++;
      else if (r.status === 'suppressed' || r.status === 'complained') s.suppressed++;
      else if (r.status === 'pending') s.pending++;
    }
    return s;
  }, [latestByMessage]);

  if (isAdmin === false) return <Navigate to="/" replace />;

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30">Sent</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'dlq':
      case 'failed':
      case 'bounced':
        return <Badge variant="destructive">Failed</Badge>;
      case 'suppressed':
      case 'complained':
        return <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30">Suppressed</Badge>;
      default:
        return <Badge variant="outline">{status || 'unknown'}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Email Monitor"
          description="Delivery status of auth and app emails sent by the ERP."
          actions={
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard icon={Mail} label="Total" value={stats.total} tone="primary" />
          <StatCard icon={CheckCircle2} label="Sent" value={stats.sent} tone="success" />
          <StatCard icon={Clock} label="Pending" value={stats.pending} tone="muted" />
          <StatCard icon={XCircle} label="Failed" value={stats.failed} tone="destructive" />
          <StatCard icon={ShieldOff} label="Suppressed" value={stats.suppressed} tone="warning" />
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <Select value={String(rangeHours)} onValueChange={v => setRangeHours(Number(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map(r => (
                  <SelectItem key={r.hours} value={String(r.hours)}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="dlq">Failed (DLQ)</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search recipient, template, error…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No emails match these filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.template_name || '—'}</TableCell>
                      <TableCell className="text-sm">{r.recipient_email || '—'}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-md truncate">
                        {r.error_message || ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {filtered.length > 500 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Showing first 500 of {filtered.length} matching entries. Narrow filters to see more.
          </p>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'destructive' | 'warning' | 'muted';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    muted: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-tight">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Search, FileSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { RFPFormDialog } from '@/components/rfp/RFPFormDialog';
import { format } from 'date-fns';

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  awarded_vendor_id: string | null;
}

export default function RFPs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchRFPs();
  }, []);

  const fetchRFPs = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRfps((data || []) as RFP[]);
    } catch (error) {
      console.error('Error fetching RFPs:', error);
      toast.error('Failed to load RFPs');
    } finally {
      setLoading(false);
    }
  };

  const filtered = rfps.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.rfp_number.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'rfp_number', header: 'RFP #', render: (r: RFP) => <span className="font-medium">{r.rfp_number}</span> },
    { key: 'title', header: 'Title' },
    {
      key: 'deadline', header: 'Deadline',
      render: (r: RFP) => r.deadline ? format(new Date(r.deadline), 'dd MMM yyyy') : '-'
    },
    {
      key: 'status', header: 'Status',
      render: (r: RFP) => <StatusBadge status={r.status} />
    },
    {
      key: 'created_at', header: 'Created',
      render: (r: RFP) => format(new Date(r.created_at), 'dd MMM yyyy')
    },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Requests for Proposal"
          description="Create and manage RFPs, invite vendors, and evaluate proposals"
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New RFP
            </Button>
          }
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RFPs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={(r) => navigate(`/rfps/${r.id}`)}
          emptyMessage="No RFPs found. Create your first RFP to get started."
        />

        <RFPFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={fetchRFPs}
          userId={user?.id}
        />
      </div>
    </AppLayout>
  );
}

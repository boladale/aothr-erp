import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { ProcurementDashboard } from '@/components/dashboard/ProcurementDashboard';

export default function ProcurementDashboardPage() {
  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Procurement Dashboard" description="Purchase orders, requisitions, and vendor activity overview." />
        <ProcurementDashboard />
      </div>
    </AppLayout>
  );
}

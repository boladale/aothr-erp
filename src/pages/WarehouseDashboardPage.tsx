import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { WarehouseDashboard } from '@/components/dashboard/WarehouseDashboard';

export default function WarehouseDashboardPage() {
  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader title="Warehouse Dashboard" description="Goods receipts, inventory levels, and stock movement overview." />
        <WarehouseDashboard />
      </div>
    </AppLayout>
  );
}

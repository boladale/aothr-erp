import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/hooks/useAuth';
import { ProcurementDashboard } from '@/components/dashboard/ProcurementDashboard';
import { WarehouseDashboard } from '@/components/dashboard/WarehouseDashboard';
import { APDashboard } from '@/components/dashboard/APDashboard';
import { RequisitionerDashboard } from '@/components/dashboard/RequisitionerDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { DashboardNotifications } from '@/components/dashboard/DashboardNotifications';

export default function Dashboard() {
  const { profile, hasRole } = useAuth();

  const isAdmin = hasRole('admin');
  const isProcurement = hasRole('procurement_manager') || hasRole('procurement_officer');
  const isWarehouse = hasRole('warehouse_manager') || hasRole('warehouse_officer');
  const isAP = hasRole('accounts_payable') || hasRole('ap_clerk');
  const isRequisitioner = hasRole('requisitioner');
  const isViewer = hasRole('viewer');

  const showDefault = !isAdmin && !isProcurement && !isWarehouse && !isAP && !isRequisitioner && !isViewer;

  return (
    <AppLayout>
      <div className="page-container space-y-8">
        <PageHeader 
          title={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}`}
          description="Here's what's happening with your operations today."
        />

        {/* Notifications section - always visible */}
        <DashboardNotifications />

        {isAdmin && <AdminDashboard />}
        {(isAdmin || isProcurement) && <ProcurementDashboard />}
        {(isAdmin || isWarehouse) && <WarehouseDashboard />}
        {(isAdmin || isAP) && <APDashboard />}
        {(isAdmin || isRequisitioner || showDefault) && <RequisitionerDashboard />}

        {isViewer && !isAdmin && !isProcurement && !isWarehouse && !isAP && !isRequisitioner && (
          <div className="space-y-6">
            <ProcurementDashboard />
            <WarehouseDashboard />
            <APDashboard />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { VendorRegistrationsPanel } from '@/components/admin/VendorRegistrationsPanel';

export default function VendorRegistrations() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Vendor Registrations"
          description="Review and approve or reject vendor registration requests"
        />
        <VendorRegistrationsPanel />
      </div>
    </AppLayout>
  );
}

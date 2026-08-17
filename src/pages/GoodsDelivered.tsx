import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseMovementReports } from '@/components/warehouse/WarehouseMovementReports';

export default function GoodsDelivered() {
  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader
          title="Goods Delivered"
          description="View-only record of goods delivered by vendors and received at the warehouse. Filter by location and date, then export to PDF or CSV."
        />
        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">Delivered Items</TabsTrigger>
            <TabsTrigger value="notes">Delivery Documents (GRN)</TabsTrigger>
          </TabsList>
          <TabsContent value="items">
            <WarehouseMovementReports kind="received-items" />
          </TabsContent>
          <TabsContent value="notes">
            <WarehouseMovementReports kind="grn-list" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

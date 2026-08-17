import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseMovementReports } from '@/components/warehouse/WarehouseMovementReports';
import { GoodsDeliveredByPO } from '@/components/warehouse/GoodsDeliveredByPO';

export default function GoodsDelivered() {
  return (
    <AppLayout>
      <div className="page-container space-y-6">
        <PageHeader
          title="Goods Delivered"
          description="View-only record of goods delivered by vendors, tracked per purchase order line with every delivery date and quantity. Export to PDF, CSV or Excel."
        />
        <Tabs defaultValue="by-po" className="space-y-4">
          <TabsList>
            <TabsTrigger value="by-po">By Purchase Order</TabsTrigger>
            <TabsTrigger value="items">Delivered Items</TabsTrigger>
            <TabsTrigger value="notes">Delivery Documents (GRN)</TabsTrigger>
          </TabsList>
          <TabsContent value="by-po">
            <GoodsDeliveredByPO />
          </TabsContent>
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


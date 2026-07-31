import { formatCurrency } from '@/lib/utils';
import {
  notifyInternal,
  PROCUREMENT_TEAM,
  FINANCE_STAFF,
  WAREHOUSE_STAFF,
} from '@/lib/procurement-emails';

type POLike = {
  id: string;
  po_number: string;
  total_amount?: number | null;
  created_by?: string | null;
  vendors?: { name?: string | null } | null;
};

/** Internal notice that a PO was approved (vendors are NOT emailed). */
export function notifyPOApproved(po: POLike) {
  return notifyInternal('po_approved', {
    roles: Array.from(new Set([...PROCUREMENT_TEAM, ...FINANCE_STAFF, ...WAREHOUSE_STAFF])),
    userIds: [po.created_by],
    subject: `PO ${po.po_number} approved`,
    message: `Purchase Order ${po.po_number} for ${po.vendors?.name || 'vendor'} totalling ${formatCurrency(po.total_amount || 0)} has been approved.`,
    path: `/purchase-orders/${po.id}`,
    idempotencyKey: `po-approved-${po.id}`,
    templateData: { poNumber: po.po_number, totalAmount: po.total_amount },
  });
}

/** Internal notice that a vendor acknowledged a PO. */
export function notifyPOAcknowledged(po: POLike) {
  return notifyInternal('po_acknowledged', {
    roles: PROCUREMENT_TEAM,
    userIds: [po.created_by],
    subject: `PO ${po.po_number} acknowledged by vendor`,
    message: `${po.vendors?.name || 'The vendor'} has acknowledged Purchase Order ${po.po_number}.`,
    path: `/purchase-orders/${po.id}`,
    idempotencyKey: `po-ack-${po.id}`,
  });
}

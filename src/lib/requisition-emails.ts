import { supabase } from '@/integrations/supabase/client';
import { triggerEmailEvent } from '@/lib/emailEvents';

type ReqLike = {
  id: string;
  req_number: string;
  department?: string | null;
  requester_name?: string | null;
  needed_by_date?: string | null;
};

/**
 * Notify approving officers (admin / procurement_manager) that a requisition
 * was submitted for approval. Additional recipients configured on the
 * `pr_submitted` email event are added automatically.
 */
export async function notifyApproversOfPRSubmission(req: ReqLike) {
  let emails: string[] = [];
  try {
    const { data: approverRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'procurement_manager'] as any);
    const ids = Array.from(new Set((approverRoles || []).map((r: any) => r.user_id))).filter(Boolean);
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('email').in('user_id', ids);
      emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
    }
  } catch (e) {
    console.error('Failed to resolve PR approvers', e);
  }

  const details = [
    req.requester_name ? `Requested by: ${req.requester_name}` : null,
    req.department ? `Department: ${req.department}` : null,
    req.needed_by_date ? `Needed by: ${req.needed_by_date}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return triggerEmailEvent('pr_submitted', {
    recipientEmails: emails,
    subject: `Requisition ${req.req_number} submitted for approval`,
    message: `Purchase Requisition ${req.req_number} has been submitted and is awaiting your approval.${details ? ` ${details}.` : ''}`,
    actionUrl: `${window.location.origin}/requisitions/${req.id}`,
    idempotencyKey: `pr-submit-${req.id}`,
    templateData: {
      reqNumber: req.req_number,
      department: req.department || undefined,
      requesterName: req.requester_name || undefined,
    },
  });
}

/** Notify the requester (and procurement team) that a requisition was approved. */
export async function notifyPRApproved(req: ReqLike & { requester_id?: string | null }) {
  const { notifyInternal, PROCUREMENT_TEAM } = await import('@/lib/procurement-emails');
  return notifyInternal('pr_approved', {
    roles: PROCUREMENT_TEAM,
    userIds: [req.requester_id],
    subject: `Requisition ${req.req_number} approved`,
    message: `Purchase Requisition ${req.req_number}${req.department ? ` (${req.department})` : ''} has been approved and can now be converted to an RFQ or Purchase Order.`,
    path: `/requisitions/${req.id}`,
    idempotencyKey: `pr-approved-${req.id}`,
    templateData: { reqNumber: req.req_number },
  });
}

/** Notify the requester that a requisition was returned/rejected. */
export async function notifyPRRejected(
  req: ReqLike & { requester_id?: string | null },
  reason: string,
) {
  const { notifyInternal, PROCUREMENT_TEAM } = await import('@/lib/procurement-emails');
  return notifyInternal('pr_rejected', {
    roles: PROCUREMENT_TEAM,
    userIds: [req.requester_id],
    subject: `Requisition ${req.req_number} returned for corrections`,
    message: `Purchase Requisition ${req.req_number} was not approved. Reason: ${reason || 'Returned for corrections'}. Please review and resubmit.`,
    path: `/requisitions/${req.id}`,
    idempotencyKey: `pr-rejected-${req.id}-${Date.now()}`,
    templateData: { reqNumber: req.req_number, reason },
  });
}

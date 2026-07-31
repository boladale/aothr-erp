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

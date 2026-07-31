import { supabase } from '@/integrations/supabase/client';
import { triggerEmailEvent } from '@/lib/emailEvents';

/** Resolve profile emails for a set of app roles. */
export async function emailsForRoles(roles: string[]): Promise<string[]> {
  try {
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', roles as any);
    const ids = Array.from(new Set((roleRows || []).map((r: any) => r.user_id))).filter(Boolean);
    return emailsForUsers(ids);
  } catch (e) {
    console.error('emailsForRoles failed', e);
    return [];
  }
}

/** Resolve profile emails for a set of user ids. */
export async function emailsForUsers(ids: (string | null | undefined)[]): Promise<string[]> {
  const clean = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (clean.length === 0) return [];
  try {
    const { data } = await supabase.from('profiles').select('email').in('user_id', clean);
    return (data || []).map((p: any) => p.email).filter(Boolean);
  } catch (e) {
    console.error('emailsForUsers failed', e);
    return [];
  }
}

type NotifyOptions = {
  roles?: string[];
  userIds?: (string | null | undefined)[];
  subject: string;
  message: string;
  path?: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
};

/**
 * Internal-only procurement notification. Never emails vendors — recipients are
 * resolved from staff roles / user ids, plus any extra addresses configured on
 * the event in Email Events.
 */
export async function notifyInternal(eventKey: string, opts: NotifyOptions) {
  try {
    const [roleEmails, userEmails] = await Promise.all([
      opts.roles?.length ? emailsForRoles(opts.roles) : Promise.resolve([]),
      opts.userIds?.length ? emailsForUsers(opts.userIds) : Promise.resolve([]),
    ]);
    return await triggerEmailEvent(eventKey, {
      recipientEmails: Array.from(new Set([...roleEmails, ...userEmails])),
      subject: opts.subject,
      message: opts.message,
      actionUrl: `${window.location.origin}${opts.path || ''}`,
      idempotencyKey: opts.idempotencyKey,
      templateData: opts.templateData,
    });
  } catch (e) {
    console.error(`${eventKey} email failed`, e);
    return { error: (e as Error).message };
  }
}

/** Approving officers for procurement documents. */
export const PROCUREMENT_APPROVERS = ['admin', 'procurement_manager'];
/** Finance / AP staff. */
export const FINANCE_STAFF = ['admin', 'finance_manager', 'accounts_payable', 'ap_clerk'];
/** Warehouse staff. */
export const WAREHOUSE_STAFF = ['admin', 'warehouse_manager', 'procurement_manager'];
/** Procurement team (officers included). */
export const PROCUREMENT_TEAM = ['admin', 'procurement_manager', 'procurement_officer'];

import { supabase } from '@/integrations/supabase/client';

export type EventContext = {
  subject?: string;
  message?: string;
  actionUrl?: string;
  recipientEmails?: string[];
  templateData?: Record<string, any>;
  idempotencyKey?: string;
};

/**
 * Trigger an email for a configured business event.
 * Silently no-ops when the event is disabled or has no resolvable recipients.
 */
export async function triggerEmailEvent(eventKey: string, ctx: EventContext = {}) {
  try {
    const { data: setting } = await supabase
      .from('email_event_settings' as any)
      .select('*')
      .eq('event_key', eventKey)
      .maybeSingle();

    const s: any = setting;
    if (!s || !s.enabled) return { skipped: true, reason: 'disabled' };

    const recipients = new Set<string>();
    (ctx.recipientEmails || []).forEach((e) => e && recipients.add(e));
    (s.extra_emails || []).forEach((e: string) => e && recipients.add(e));

    if (recipients.size === 0) return { skipped: true, reason: 'no_recipients' };

    const results = await Promise.all(
      Array.from(recipients).map((email) =>
        supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: s.template_name || 'notification',
            recipientEmail: email,
            idempotencyKey: ctx.idempotencyKey
              ? `${eventKey}-${ctx.idempotencyKey}-${email}`
              : `${eventKey}-${Date.now()}-${email}`,
            templateData: {
              subject: ctx.subject || s.event_label,
              message: ctx.message || '',
              actionUrl: ctx.actionUrl || window.location.origin,
              ...(ctx.templateData || {}),
            },
          },
        }),
      ),
    );

    return { sent: results.length };
  } catch (err) {
    console.error('triggerEmailEvent failed', eventKey, err);
    return { error: (err as Error).message };
  }
}

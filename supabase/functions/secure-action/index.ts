// Server-side validation gate for high-risk state transitions.
// Centralizes auth + permission + zod validation + privileged update.
// Actions: po_approve, invoice_post, payment_post, payroll_approve, grn_post
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'

const IdSchema = z.object({ id: z.string().uuid() })
const IdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('po_approve'), payload: z.union([IdSchema, IdsSchema]) }),
  z.object({ action: z.literal('invoice_post'), payload: IdSchema }),
  z.object({ action: z.literal('payment_post'), payload: IdSchema }),
  z.object({ action: z.literal('payroll_approve'), payload: IdSchema }),
  z.object({ action: z.literal('grn_post'), payload: IdSchema }),
])

// action -> required permission code
const PERM: Record<string, string> = {
  po_approve: 'purchase_orders',
  invoice_post: 'invoices',
  payment_post: 'ap_payments',
  payroll_approve: 'payroll_runs',
  grn_post: 'goods_receipts',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // user-scoped client to verify identity + permissions via SECURITY DEFINER fn
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const userId = claimsData.claims.sub as string

    const body = await req.json().catch(() => null)
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }
    const { action, payload } = parsed.data

    // permission check
    const { data: permOk, error: permErr } = await userClient.rpc('has_permission', {
      p_code: PERM[action],
    })
    if (permErr) return jsonResponse({ error: 'Permission check failed' }, 500)
    if (!permOk) return jsonResponse({ error: 'Forbidden: missing permission ' + PERM[action] }, 403)

    // Privileged client for the actual write. Triggers enforce business rules.
    const admin = createClient(SUPABASE_URL, SERVICE)
    const nowIso = new Date().toISOString()

    switch (action) {
      case 'po_approve': {
        const ids = 'ids' in payload ? payload.ids : [payload.id]
        // Only approve POs currently in 'pending_approval' to prevent state-jump abuse
        const { data, error } = await admin
          .from('purchase_orders')
          .update({ status: 'approved', approved_by: userId, approved_at: nowIso })
          .in('id', ids)
          .eq('status', 'pending_approval')
          .select('id')
        if (error) return jsonResponse({ error: error.message }, 400)
        if (!data?.length) return jsonResponse({ error: 'No POs in pending_approval status' }, 409)
        // Record approval log entries
        await admin.from('po_approvals').insert(
          data.map((d) => ({ po_id: d.id, approved_by: userId, approved_at: nowIso }))
        )
        return jsonResponse({ ok: true, updated: data.length })
      }
      case 'invoice_post': {
        const { data, error } = await admin
          .from('ap_invoices')
          .update({ status: 'posted', posted_at: nowIso, posted_by: userId })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: error.message }, 400)
        if (!data?.length) return jsonResponse({ error: 'Invoice not in draft status' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'payment_post': {
        const { data, error } = await admin
          .from('ap_payments')
          .update({ status: 'posted' })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: error.message }, 400)
        if (!data?.length) return jsonResponse({ error: 'Payment not in draft status' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'payroll_approve': {
        const { data, error } = await admin
          .from('payroll_runs')
          .update({ status: 'approved', approved_by: userId, approved_at: nowIso })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: error.message }, 400)
        if (!data?.length) return jsonResponse({ error: 'Payroll run not in draft status' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'grn_post': {
        const { data, error } = await admin
          .from('goods_receipts')
          .update({ status: 'posted', posted_at: nowIso, posted_by: userId })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: error.message }, 400)
        if (!data?.length) return jsonResponse({ error: 'GRN not in draft status' }, 409)
        return jsonResponse({ ok: true })
      }
    }
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Internal error' }, 500)
  }
})

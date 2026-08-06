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

const ACTION_TABLE: Record<string, string> = {
  po_approve: 'purchase_orders',
  invoice_post: 'ap_invoices',
  payment_post: 'ap_payments',
  payroll_approve: 'payroll_runs',
  grn_post: 'goods_receipts',
}


// Turn Postgres/PostgREST errors into a sentence the user can act on.
function describeDbError(error: any, whatWeWereDoing: string): string {
  const code = String(error?.code ?? '')
  const raw = String(error?.message ?? '').replace(/^ERROR:\s*/i, '').trim()
  switch (code) {
    case '23505':
      return `A record with the same reference already exists, so ${whatWeWereDoing} was stopped. Check for a duplicate document number.`
    case '23503':
      return `A linked record (vendor, item, account or period) referenced here no longer exists, so ${whatWeWereDoing} was stopped. Refresh the page and re-select it.`
    case '23502':
      return `A required field is missing on this document, so ${whatWeWereDoing} was stopped. Open the record and complete all mandatory fields.`
    case '23514':
      return `A value on this document breaks a business rule (such as a negative quantity or amount), so ${whatWeWereDoing} was stopped.`
    case '42501':
      return `Your account is not allowed to change this record, so ${whatWeWereDoing} was stopped. Ask an Admin to grant the required role.`
    case '40P01':
    case '55P03':
      return `Another user is working on this record right now, so ${whatWeWereDoing} could not be completed. Please retry in a few seconds.`
    default:
      return raw
        ? `${raw} (while ${whatWeWereDoing})`
        : `An unexpected problem stopped ${whatWeWereDoing}. Please refresh the page and try again.`
  }
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
      return jsonResponse({ error: 'You are not signed in. Please sign in again and retry this action.' }, 401)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // user-scoped client to verify identity + permissions via SECURITY DEFINER fn
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      console.error('auth.getUser failed', userErr)
      return jsonResponse({ error: 'Your session has expired or is invalid. Please sign out, sign in again, and retry.', detail: userErr?.message }, 401)
    }
    const userId = userData.user.id

    const body = await req.json().catch(() => null)
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse({ error: 'The request sent to the server was incomplete or malformed. Refresh the page and try the action again.', details: parsed.error.flatten() }, 400)
    }
    const { action, payload } = parsed.data

    // Admin is the organization superuser; other roles require the module permission.
    const { data: isAdmin, error: adminRoleErr } = await userClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (adminRoleErr) {
      console.error('has_role rpc failed', adminRoleErr)
      return jsonResponse({ error: 'Your Admin status could not be verified. Please refresh the page and try again.' }, 500)
    }

    const { data: permOk, error: permErr } = await userClient.rpc('has_permission', {
      p_code: PERM[action],
    })
    if (permErr) {
      console.error('has_permission rpc failed', permErr)
      return jsonResponse({ error: 'Your permissions could not be verified. Please refresh the page; if it repeats, ask an Admin to confirm your role assignment.', detail: permErr.message }, 500)
    }
    if (!isAdmin && !permOk) {
      return jsonResponse({
        error: `You do not have permission to perform this action. Ask an Admin to grant your role access to ${PERM[action].replace(/_/g, ' ')}.`,
      }, 403)
    }

    // Privileged client for the actual write. Triggers enforce business rules.
    const admin = createClient(SUPABASE_URL, SERVICE)
    const nowIso = new Date().toISOString()

    // Never allow the privileged writer to update a record in another organization.
    const recordIds = 'ids' in payload ? payload.ids : [payload.id]
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (profileErr || !profile?.organization_id) {
      console.error('profile organization lookup failed', profileErr)
      return jsonResponse({ error: 'Your account is not linked to an organization. Ask an Admin to correct your user profile.' }, 403)
    }
    const { data: ownedRecords, error: ownershipErr } = await admin
      .from(ACTION_TABLE[action])
      .select('id')
      .in('id', recordIds)
      .eq('organization_id', profile.organization_id)
    if (ownershipErr) {
      console.error('record organization check failed', ownershipErr)
      return jsonResponse({ error: 'The organization for this document could not be verified. Refresh the page and try again.' }, 500)
    }
    if (!ownedRecords || ownedRecords.length !== recordIds.length) {
      return jsonResponse({ error: 'This document belongs to another organization or no longer exists. It cannot be changed from your account.' }, 403)
    }

    switch (action) {
      case 'po_approve': {
        const ids = 'ids' in payload ? payload.ids : [payload.id]
        // Admins (superusers) may override separation of duties
        if (!isAdmin) {
          // Block self-approval: a user cannot approve a PO they created
          const { data: ownPOs } = await admin
            .from('purchase_orders')
            .select('id')
            .in('id', ids)
            .eq('created_by', userId)
          if (ownPOs && ownPOs.length > 0) {
            return jsonResponse({
              ok: false,
              error: 'Separation of duties: you cannot approve a Purchase Order you created. Please ask another approver or an Admin.',
            })
          }
        }

        // Only approve POs currently in 'pending_approval' to prevent state-jump abuse
        const { data, error } = await admin
          .from('purchase_orders')
          .update({ status: 'approved', approved_by: userId, approved_at: nowIso })
          .in('id', ids)
          .eq('status', 'pending_approval')
          .select('id')
        if (error) {
          console.error('po_approve update failed', JSON.stringify(error))
          return jsonResponse({ error: describeDbError(error, 'approving this Purchase Order'), details: error.details, hint: error.hint }, 400)
        }
        if (!data?.length) {
          return jsonResponse({
            ok: false,
            error: 'This Purchase Order is not awaiting approval — it may already be approved, sent, cancelled, or still in draft. Refresh the page to see its current status.',
          })
        }
        // Record approval log entries
        await admin.from('po_approvals').insert(
          data.map((d) => ({ po_id: d.id, approved_by: userId, approved_at: nowIso }))
        )
        return jsonResponse({ ok: true, updated: data.length })
      }

      case 'invoice_post': {
        const ACTION_LABEL = 'posting this vendor invoice'
        const { data, error } = await admin
          .from('ap_invoices')
          .update({ status: 'posted', posted_at: nowIso, posted_by: userId })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: describeDbError(error, ACTION_LABEL) }, 400)
        if (!data?.length) return jsonResponse({ error: 'This invoice is not in draft status, so it cannot be posted again. Refresh the page to see its current status.' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'payment_post': {
        const ACTION_LABEL = 'posting this payment'
        const { data, error } = await admin
          .from('ap_payments')
          .update({ status: 'posted' })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: describeDbError(error, ACTION_LABEL) }, 400)
        if (!data?.length) return jsonResponse({ error: 'This payment is not in draft status, so it cannot be posted again. Refresh the page to see its current status.' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'payroll_approve': {
        const ACTION_LABEL = 'approving this payroll run'
        const { data, error } = await admin
          .from('payroll_runs')
          .update({ status: 'approved', approved_by: userId, approved_at: nowIso })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: describeDbError(error, ACTION_LABEL) }, 400)
        if (!data?.length) return jsonResponse({ error: 'This payroll run is not in draft status, so it cannot be approved again. Refresh the page to see its current status.' }, 409)
        return jsonResponse({ ok: true })
      }
      case 'grn_post': {
        const ACTION_LABEL = 'posting this goods receipt'
        const { data, error } = await admin
          .from('goods_receipts')
          .update({ status: 'posted', posted_at: nowIso, posted_by: userId })
          .eq('id', payload.id)
          .eq('status', 'draft')
          .select('id')
        if (error) return jsonResponse({ error: describeDbError(error, ACTION_LABEL) }, 400)
        if (!data?.length) return jsonResponse({ error: 'This goods receipt note is not in draft status, so it cannot be posted again. Refresh the page to see its current status.' }, 409)
        return jsonResponse({ ok: true })
      }
    }
  } catch (e) {
    console.error('secure-action unhandled failure', e)
    return jsonResponse({
      error: (e as Error)?.message
        ? `The server could not complete this action: ${(e as Error).message}`
        : 'The server could not complete this action due to an unexpected internal problem. Please try again; if it persists, contact your Administrator.',
    }, 500)
  }
})

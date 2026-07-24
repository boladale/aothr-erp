// Receives BoldSign webhook callbacks and updates signature_requests.
// Configure the webhook URL in the BoldSign dashboard to point here.
// No JWT verification: webhook is public. Payload identifies the org
// via the boldsign_document_id lookup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

const STATUS_MAP: Record<string, string> = {
  Sent: "sent",
  Viewed: "viewed",
  Completed: "signed",
  Declined: "declined",
  Expired: "expired",
  Revoked: "revoked",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    // BoldSign webhook shape: { event: { eventType, documentId, ... }, data: {...} }
    const eventType = body?.event?.eventType || body?.eventType;
    const documentId = body?.data?.documentId || body?.event?.documentId || body?.documentId;
    const status = body?.data?.status || body?.status;

    if (!documentId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no documentId" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: sr } = await admin.from("signature_requests")
      .select("*").eq("boldsign_document_id", documentId).maybeSingle();
    if (!sr) return new Response(JSON.stringify({ ok: true, ignored: "unknown doc" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const mapped = STATUS_MAP[status] || (
      eventType === "Completed" ? "signed" :
      eventType === "Declined" ? "declined" :
      eventType === "Viewed" ? "viewed" :
      eventType === "Expired" ? "expired" :
      sr.status
    );

    let signedPdfUrl = sr.signed_pdf_url;
    if (mapped === "signed" && !signedPdfUrl) {
      const { data: org } = await admin.from("organizations")
        .select("boldsign_api_key").eq("id", sr.organization_id).maybeSingle();
      if (org?.boldsign_api_key) {
        const dl = await fetch(`https://api.boldsign.com/v1/document/download?documentId=${encodeURIComponent(documentId)}`, {
          headers: { "X-API-KEY": org.boldsign_api_key },
        });
        if (dl.ok) {
          const bytes = new Uint8Array(await dl.arrayBuffer());
          const path = `${sr.organization_id}/${sr.id}.pdf`;
          const { error: upErr } = await admin.storage.from("signed-documents").upload(path, bytes, { contentType: "application/pdf", upsert: true });
          if (!upErr) signedPdfUrl = path;
        }
      }
    }

    await admin.from("signature_requests").update({
      status: mapped,
      signed_pdf_url: signedPdfUrl,
      viewed_at: mapped === "viewed" ? (sr.viewed_at || new Date().toISOString()) : sr.viewed_at,
      signed_at: mapped === "signed" ? (sr.signed_at || new Date().toISOString()) : sr.signed_at,
      declined_at: mapped === "declined" ? (sr.declined_at || new Date().toISOString()) : sr.declined_at,
    }).eq("id", sr.id);

    return new Response(JSON.stringify({ ok: true, status: mapped }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("boldsign-webhook error", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Manually refresh the status of a signature request from BoldSign.
// If the document is completed, the signed PDF is downloaded and stored.
// Body: { signature_request_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STATUS_MAP: Record<string, string> = {
  Sent: "sent",
  InProgress: "sent",
  Viewed: "viewed",
  Completed: "signed",
  Declined: "declined",
  Expired: "expired",
  Revoked: "revoked",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const admin = createClient(url, service);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { signature_request_id } = await req.json();
    if (!signature_request_id) return new Response(JSON.stringify({ error: "Missing signature_request_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sr } = await admin.from("signature_requests").select("*").eq("id", signature_request_id).maybeSingle();
    if (!sr || !sr.boldsign_document_id) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: org } = await admin.from("organizations").select("boldsign_api_key").eq("id", sr.organization_id).maybeSingle();
    if (!org?.boldsign_api_key) return new Response(JSON.stringify({ error: "No API key" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const propsResp = await fetch(`https://api.boldsign.com/v1/document/properties?documentId=${encodeURIComponent(sr.boldsign_document_id)}`, {
      headers: { "X-API-KEY": org.boldsign_api_key },
    });
    const propsText = await propsResp.text();
    let props: any = null; try { props = JSON.parse(propsText); } catch {}
    if (!propsResp.ok) {
      return new Response(JSON.stringify({ error: "BoldSign lookup failed", detail: propsText.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bsStatus = props?.status || props?.Status;
    const mapped = STATUS_MAP[bsStatus] || sr.status;
    let signedPdfUrl = sr.signed_pdf_url;

    if (mapped === "signed" && !signedPdfUrl) {
      const dl = await fetch(`https://api.boldsign.com/v1/document/download?documentId=${encodeURIComponent(sr.boldsign_document_id)}`, {
        headers: { "X-API-KEY": org.boldsign_api_key },
      });
      if (dl.ok) {
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const path = `${sr.organization_id}/${sr.id}.pdf`;
        const { error: upErr } = await admin.storage.from("signed-documents").upload(path, bytes, { contentType: "application/pdf", upsert: true });
        if (!upErr) signedPdfUrl = path;
        else console.error("upload signed pdf failed", upErr);
      }
    }

    await admin.from("signature_requests").update({
      status: mapped,
      signed_pdf_url: signedPdfUrl,
      signed_at: mapped === "signed" ? (sr.signed_at || new Date().toISOString()) : sr.signed_at,
      declined_at: mapped === "declined" ? (sr.declined_at || new Date().toISOString()) : sr.declined_at,
    }).eq("id", sr.id);

    return new Response(JSON.stringify({ success: true, status: mapped, signed_pdf_path: signedPdfUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("boldsign-status error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

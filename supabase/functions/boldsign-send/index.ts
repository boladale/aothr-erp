// Sends a document to BoldSign for signature using the organization's own API key.
// Body: { document_type, document_id, document_number, signer_name, signer_email,
//         title, message?, pdf_base64 }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(url, service);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json();
    const {
      document_type, document_id, document_number,
      signer_name, signer_email, title, message, pdf_base64,
    } = body || {};

    if (!document_type || !document_id || !signer_name || !signer_email || !pdf_base64 || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org + API key (via admin client; RLS-safe because we verify the profile)
    const { data: profile } = await admin
      .from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("boldsign_api_key, boldsign_enabled")
      .eq("id", orgId).maybeSingle();

    if (!org?.boldsign_enabled || !org?.boldsign_api_key) {
      return new Response(JSON.stringify({
        error: "BoldSign is not configured for your organization. An admin must add an API key in Admin → Organization Settings.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build BoldSign send-document request (multipart)
    const pdfBytes = b64ToBytes(pdf_base64);
    const fileName = `${(document_number || title).replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;

    const signers = [{
      Name: signer_name,
      EmailAddress: signer_email,
      SignerType: "Signer",
      SignerOrder: 1,
      FormFields: [{
        FieldType: "Signature",
        PageNumber: 1,
        Bounds: { X: 350, Y: 700, Width: 180, Height: 40 },
        IsRequired: true,
      }, {
        FieldType: "DateSigned",
        PageNumber: 1,
        Bounds: { X: 350, Y: 750, Width: 180, Height: 20 },
        IsRequired: false,
      }],
    }];

    const form = new FormData();
    form.append("Files", new Blob([pdfBytes], { type: "application/pdf" }), fileName);
    form.append("Title", title);
    if (message) form.append("Message", message);
    form.append("Signers", JSON.stringify(signers));
    form.append("DisableEmails", "false");
    form.append("EnableSigningOrder", "false");
    form.append("ExpiryDays", "30");

    const bsResp = await fetch("https://api.boldsign.com/v1/document/send", {
      method: "POST",
      headers: { "X-API-KEY": org.boldsign_api_key },
      body: form,
    });

    const bsText = await bsResp.text();
    let bsJson: any = null;
    try { bsJson = JSON.parse(bsText); } catch { /* ignore */ }

    if (!bsResp.ok) {
      console.error("BoldSign send failed", bsResp.status, bsText);
      // Log failure
      await admin.from("signature_requests").insert({
        organization_id: orgId,
        document_type, document_id, document_number,
        signer_name, signer_email,
        sent_by: user.id,
        status: "failed",
        error_message: `BoldSign ${bsResp.status}: ${bsText.slice(0, 500)}`,
      });
      return new Response(JSON.stringify({
        error: bsJson?.error || bsJson?.message || `BoldSign error (${bsResp.status})`,
        detail: bsText.slice(0, 800),
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const boldsignDocId = bsJson?.documentId || bsJson?.DocumentId;

    const { data: inserted, error: insErr } = await admin.from("signature_requests").insert({
      organization_id: orgId,
      document_type, document_id, document_number,
      signer_name, signer_email,
      sent_by: user.id,
      boldsign_document_id: boldsignDocId,
      status: "sent",
    }).select().single();

    if (insErr) {
      console.error("insert signature_request failed", insErr);
    }

    return new Response(JSON.stringify({
      success: true,
      boldsign_document_id: boldsignDocId,
      signature_request_id: inserted?.id,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("boldsign-send error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

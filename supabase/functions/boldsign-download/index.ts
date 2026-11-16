// Returns a short-lived download link for a signed PDF, only if the caller can see
// the matching signature request (enforced by the database's access rules).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Missing auth" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Invalid session" }, 401);

    const { path } = await req.json().catch(() => ({}));
    if (typeof path !== "string" || !path || path.length > 500 || path.includes("..")) {
      return json({ error: "Invalid path" }, 400);
    }
    // RLS on signature_requests limits this to the caller's own company
    const { data: row } = await userClient
      .from("signature_requests").select("id").eq("signed_pdf_url", path).maybeSingle();
    if (!row) return json({ error: "Document not found" }, 404);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.storage.from("signed-documents").createSignedUrl(path, 60);
    if (error || !data) return json({ error: "Could not prepare download" }, 500);
    return json({ url: data.signedUrl });
  } catch (_e) {
    return json({ error: "Unexpected error" }, 500);
  }
});

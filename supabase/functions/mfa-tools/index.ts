import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Google Authenticator helpers: backup codes, lost-phone recovery and admin reset.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normalize = (c: string) => c.replace(/[^a-z0-9]/gi, "").toUpperCase();
function newCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(b, (x) => chars[x % chars.length]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
function jwtAal(token: string): string | undefined {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return undefined; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return json({ error: "Please sign in again." });
    const me = u.user;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const deleteFactors = async (userId: string) => {
      const { data } = await admin.auth.admin.mfa.listFactors({ userId });
      for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    };

    if (action === "generate_backup_codes") {
      if (jwtAal(token) !== "aal2") return json({ error: "Enter your authenticator code first." });
      const codes = Array.from({ length: 10 }, newCode);
      await admin.from("mfa_backup_codes").delete().eq("user_id", me.id);
      const rows = await Promise.all(codes.map(async (c) => ({ user_id: me.id, code_hash: await sha256(normalize(c)) })));
      const { error } = await admin.from("mfa_backup_codes").insert(rows);
      if (error) throw error;
      return json({ codes });
    }

    if (action === "redeem_backup_code") {
      const code = normalize(String(body.code ?? ""));
      if (code.length !== 10) return json({ error: "That backup code doesn't look right." });
      const hash = await sha256(code);
      const { data: row } = await admin.from("mfa_backup_codes").select("id").eq("user_id", me.id).eq("code_hash", hash).is("used_at", null).maybeSingle();
      if (!row) return json({ error: "That backup code is not valid or was already used." });
      await admin.from("mfa_backup_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      await deleteFactors(me.id);
      return json({ ok: true });
    }

    if (action === "admin_list" || action === "admin_reset") {
      const { data: isAdmin } = await admin.from("user_roles").select("role").eq("user_id", me.id).eq("role", "admin").maybeSingle();
      const { data: myProf } = await admin.from("profiles").select("organization_id").eq("user_id", me.id).maybeSingle();
      if (!isAdmin || !myProf?.organization_id) return json({ error: "Only admins can do this." });
      const org = myProf.organization_id;

      if (action === "admin_list") {
        const { data: people } = await admin.from("profiles").select("user_id, full_name, email, is_active").eq("organization_id", org).order("full_name");
        const out = [];
        for (const p of people ?? []) {
          const { data } = await admin.auth.admin.mfa.listFactors({ userId: p.user_id });
          out.push({ ...p, has_authenticator: (data?.factors ?? []).some((f: any) => f.status === "verified") });
        }
        return json({ users: out });
      }

      const target = String(body.user_id ?? "");
      const { data: tProf } = await admin.from("profiles").select("organization_id").eq("user_id", target).maybeSingle();
      if (!tProf || tProf.organization_id !== org) return json({ error: "That person isn't in your company." });
      await deleteFactors(target);
      await admin.from("mfa_backup_codes").delete().eq("user_id", target);
      await admin.from("audit_logs").insert({ organization_id: org, user_id: me.id, action: "mfa_reset", table_name: "auth.mfa_factors", record_id: target }).then(() => {}, () => {});
      return json({ ok: true });
    }

    return json({ error: "Unknown action" });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// One-click demo sign-in for website visitors. The demo account can only use Ask Aothr
// (enforced in the app) and has the executive role, which gives read-only AI summaries.
const DEMO_EMAIL = "demo@aothr.com";
const DEMO_ORG = "5e8ce8cd-369f-4cc6-8f3a-b64ccb1a03e4"; // Learnsoft IT

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const password = Deno.env.get("DEMO_USER_PASSWORD")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: prof } = await admin.from("profiles").select("user_id, organization_id").eq("email", DEMO_EMAIL).maybeSingle();
    let userId = prof?.user_id as string | undefined;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL, password, email_confirm: true, user_metadata: { full_name: "Demo Visitor" },
      });
      if (error) throw error;
      userId = data.user.id;
    }
    if (!prof?.organization_id) {
      await admin.from("profiles").update({ organization_id: DEMO_ORG, full_name: "Demo Visitor" }).eq("user_id", userId);
    }
    await admin.from("user_roles").upsert({ user_id: userId, role: "executive" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    let { data: s, error: sErr } = await anon.auth.signInWithPassword({ email: DEMO_EMAIL, password });
    if (sErr) {
      await admin.auth.admin.updateUserById(userId, { password });
      ({ data: s, error: sErr } = await anon.auth.signInWithPassword({ email: DEMO_EMAIL, password }));
    }
    if (sErr || !s.session) throw sErr ?? new Error("no session");
    return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  } catch (e) {
    console.error("demo-login", e);
    return json({ error: "The demo is not available right now. Please try again shortly." });
  }
});

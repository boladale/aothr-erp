import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Please sign in again." }, 401);

    // Company's own OpenAI key (saved by the admin under Administration → Branding)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await admin.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    if (!prof?.organization_id) return json({ error: "Your account is not linked to a company." }, 400);
    const { data: keyRow } = await admin.from("ai_provider_keys").select("openai_api_key").eq("organization_id", prof.organization_id).maybeSingle();
    const { data: settings } = await admin.from("ai_settings").select("ai_enabled, ai_model").eq("organization_id", prof.organization_id).maybeSingle();
    if (settings && settings.ai_enabled === false) return json({ error: "AI is switched off for your company." }, 403);
    const key = keyRow?.openai_api_key;
    if (!key) return json({ error: "No OpenAI key has been added for your company yet. Ask your admin to add it under Administration → Branding." }, 400);
    const model = settings?.ai_model && !settings.ai_model.includes("/") ? settings.ai_model : "gpt-4o-mini";

    const { roleLabel, name, metrics } = await req.json();
    if (!metrics || typeof metrics !== "object") return json({ error: "No data to summarise." }, 400);

    const prompt = `You are a business analyst writing a morning briefing for ${name || "a manager"} (${roleLabel}) at a Nigerian company. Amounts are in Nigerian Naira (₦).
Here are their key figures as JSON:
${JSON.stringify(metrics).slice(0, 6000)}

Write 2-3 short plain-English sentences (max 70 words) highlighting what matters most today: the biggest change, any risk, and one suggested action. No headings, no bullet points, no markdown. Use compact amounts like ₦12.5M.`;

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: prompt, stream: true }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("OpenAI error", res.status, t.slice(0, 300));
      if (res.status === 401) return json({ error: "Your company's OpenAI key was rejected. Ask your admin to check or replace it." }, 401);
      if (res.status === 429) return json({ error: "OpenAI is busy or your OpenAI credit has run out. Please check your OpenAI billing or try again shortly." }, 429);
      return json({ error: "The AI summary could not be generated." }, res.status >= 500 ? 502 : res.status);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
        } catch { /* ignore partial */ }
      }
    }
    return json({ summary: text.trim() || "No summary available right now." });
  } catch (e) {
    console.error(e);
    return json({ error: "The AI summary could not be generated." }, 500);
  }
});

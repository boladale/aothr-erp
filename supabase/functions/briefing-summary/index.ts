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

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured." }, 500);

    const { roleLabel, name, metrics } = await req.json();
    if (!metrics || typeof metrics !== "object") return json({ error: "No data to summarise." }, 400);

    const prompt = `You are a business analyst writing a morning briefing for ${name || "a manager"} (${roleLabel}) at a Nigerian company. Amounts are in Nigerian Naira (₦).
Here are their key figures as JSON:
${JSON.stringify(metrics).slice(0, 6000)}

Write 2-3 short plain-English sentences (max 70 words) highlighting what matters most today: the biggest change, any risk, and one suggested action. No headings, no bullet points, no markdown. Use compact amounts like ₦12.5M.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        reasoning: { effort: "low" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      if (res.status === 429) return json({ error: "AI is busy right now. Please try again in a minute." }, 429);
      if (res.status === 402) return json({ error: "AI credits have run out. Add credits in Settings → Plans & credits." }, 402);
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

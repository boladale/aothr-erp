import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Read-only business summaries. Each checks the user's own permissions in the database.
const TOOLS: Record<string, string> = {
  ai_business_health: "Overall company snapshot: revenue, profit, cash, receivables, payables, stock value and alerts. Start here for 'how is my business doing'.",
  ai_profit_loss_monthly: "Profit and loss by month for this year and last year (YTD comparisons), from posted journals.",
  ai_cash_position: "Cash and bank account balances.",
  ai_receivables: "Money customers owe, aged (current, 1-30, 31-60, 61-90, 90+ days) with top debtors.",
  ai_payables: "Money owed to suppliers, aged, with top creditors.",
  ai_sales_performance: "Quotes, sales orders and invoices by month.",
  ai_inventory_position: "Stock value by warehouse, items below reorder level, slow-moving and expiring stock.",
  ai_procurement_position: "Purchase orders by status, overdue deliveries, approvals waiting over 7 days, open RFQs, requisitions.",
  ai_supplier_performance: "Supplier spend YTD, on-time delivery and outstanding balances.",
  ai_payroll_position: "Payroll totals and headcount (no individual salaries).",
  ai_project_position: "Projects: budget, actual cost, revenue, margin, over-budget flags.",
  ai_business_alerts: "Current risks: negative cash, overdue invoices, low stock, stuck approvals, late deliveries, over-budget projects.",
  ai_customer_intelligence: "Customer counts, sales, balances, rising/declining customers, top customers.",
  ai_expense_analysis: "Expenses by month and category, budget vs actual, unusual movements.",
  ai_tax_position: "Tax liabilities, VAT collected and paid, tax rates in use.",
};
const toolDefs = Object.entries(TOOLS).map(([name, description]) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties: {}, additionalProperties: false } },
}));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userDb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    if (!question) return json({ error: "Please type a question." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await admin.from("profiles").select("organization_id, full_name").eq("user_id", user.id).maybeSingle();
    const org = prof?.organization_id;
    if (!org) return json({ error: "Your account is not linked to a company." }, 400);
    const { data: settings } = await admin.from("ai_settings").select("ai_enabled, ai_model").eq("organization_id", org).maybeSingle();
    if (settings && settings.ai_enabled === false) return json({ error: "AI is switched off for your company." }, 403);
    const { data: keyRow } = await admin.from("ai_provider_keys").select("openai_api_key").eq("organization_id", org).maybeSingle();
    const key = keyRow?.openai_api_key;
    if (!key) return json({ error: "No OpenAI key has been added for your company yet. Ask your admin to add it under Administration → Branding." }, 400);
    const model = settings?.ai_model && !settings.ai_model.includes("/") ? settings.ai_model : "gpt-4o-mini";

    // Conversation (own only)
    let convId = conversationId;
    if (convId) {
      const { data: c } = await admin.from("ai_conversations").select("id").eq("id", convId).eq("user_id", user.id).maybeSingle();
      if (!c) convId = null;
    }
    if (!convId) {
      const { data: c, error } = await admin.from("ai_conversations")
        .insert({ organization_id: org, user_id: user.id, title: question.slice(0, 60) }).select("id").single();
      if (error) throw error;
      convId = c.id;
    }
    const { data: history } = await admin.from("ai_messages").select("role, content")
      .eq("conversation_id", convId).order("created_at", { ascending: false }).limit(12);

    const today = new Date().toISOString().slice(0, 10);
    const messages: any[] = [
      {
        role: "system",
        content: `You are Aothr, the business assistant inside an ERP for a Nigerian company. Today is ${today}. The user is ${prof?.full_name || "a staff member"}.
Rules:
- Only use figures returned by the tools. Never invent or estimate numbers. If a tool returns an access error or no data, say so plainly.
- Amounts are Nigerian Naira; write them like ₦12.5M or ₦850,000.
- Be concise and practical: short answer first, then key figures as a short bullet list, then one suggested action when useful.
- Plain business English, no jargon, no mention of tools, databases or JSON.
- You can only read data; you cannot create, approve or change anything.`,
      },
      ...(history ?? []).reverse().map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    const used = new Set<string>();
    let answer = "";
    for (let round = 0; round < 6; round++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, tools: toolDefs }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("OpenAI error", res.status, t.slice(0, 300));
        if (res.status === 401) return json({ error: "Your company's OpenAI key was rejected. Ask your admin to check or replace it." }, 401);
        if (res.status === 429) return json({ error: "OpenAI is busy or your OpenAI credit has run out. Check your OpenAI billing or try again shortly." }, 429);
        return json({ error: "Aothr could not answer right now. Please try again." }, 502);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;
      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name;
          let result: unknown;
          if (!TOOLS[name]) result = { error: "unknown" };
          else {
            used.add(name);
            const { data: r, error } = await userDb.rpc(name as any);
            result = error ? { error: "You don't have access to this area, or it is unavailable." } : r;
          }
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 12000) });
        }
        continue;
      }
      answer = (msg.content ?? "").trim();
      break;
    }
    if (!answer) answer = "I couldn't find an answer to that from your company's data.";

    await admin.from("ai_messages").insert([
      { conversation_id: convId, organization_id: org, user_id: user.id, role: "user", content: question },
      { conversation_id: convId, organization_id: org, user_id: user.id, role: "assistant", content: answer, tools_used: [...used] },
    ]);
    await admin.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    return json({ conversationId: convId, answer, toolsUsed: [...used] });
  } catch (e) {
    console.error(e);
    return json({ error: "Aothr could not answer right now. Please try again." }, 500);
  }
});

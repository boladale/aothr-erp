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
  ai_payroll_employee_detail: "Individual staff pay from the latest approved payroll: name, department, job role, monthly gross, tax, pension, deductions, net pay, ranked highest first. Use for highest/lowest earners or a named person's pay. Restricted to payroll-permitted users.",
  ai_project_position: "Projects: budget, actual cost, revenue, margin, over-budget flags.",
  ai_business_alerts: "Current risks: negative cash, overdue invoices, low stock, stuck approvals, late deliveries, over-budget projects.",
  ai_customer_intelligence: "Customer counts, sales, balances, rising/declining customers, top customers.",
  ai_expense_analysis: "Expenses by month and category, budget vs actual, unusual movements.",
  ai_tax_position: "Tax liabilities, VAT collected and paid, tax rates in use.",
  ai_purchase_order_details: "Individual purchase orders (not closed/cancelled): PO number, status, order and expected dates, days overdue, total, supplier name/categories/phone/email, and the items on each PO with quantities and prices. Use for any question about specific POs, which supplier, what items, or how late.",
  ai_vendor_directory: "List of suppliers (vendors we buy from) with name, code, status, categories, phone, email, city and blacklist status.",
  ai_customer_directory: "List of customers (people/companies we sell to) with name, code, phone, email, address, city, payment terms and credit limit. Use for contact details of any customer.",
  ai_revenue_by_account: "Revenue by income ledger account (e.g. Sales, Service Income): year to date vs same period last year, PLUS a by_month list (YYYY-MM) with each account's amount per month for this and last year. Use for revenue sources / income lines, including for a specific month.",
  ai_revenue_breakdown: "Sales per customer (YTD, same period last year, change, share %, last invoice date, days since last purchase), top-1 and top-3 customer concentration %, sales per product/service YTD vs last year, and sales by month. Use for top customers, customers buying less, customers not buying recently, dependence on few customers, best products/services, best/worst sales months.",
  ai_cost_breakdown: "Every expense account (incl. cost of sales) YTD vs same period last year with change and %, this month vs last month, biggest increases, monthly expense totals and month-by-account detail. Use for biggest expenses, rising costs, highest-expense months, cost of goods sold drivers, cost-saving ideas, why profit moved.",
  ai_cash_outlook: "Cash now, ledger cash at each of the last 7 month-ends (for cash vs last month / trend), supplier bills overdue and due in next 30 days, customer payments expected in next 30 days, oldest unpaid customer invoices. Use for payments coming due, cash pressure, cash-flow problems, oldest balances.",
  ai_procurement_spend: "Procurement spend: PO value ordered and supplier bills YTD vs last year, payments made per supplier YTD, delivery record per supplier (deliveries, late count, avg days late), and highest-value stock items. Use for procurement spend, suppliers paid most, consistently late suppliers, highest stock value items.",
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
    if (!user) return json({ error: "Your sign-in has expired. Please refresh the page or sign in again." });

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 2000) : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    if (!question) return json({ error: "Please type a question." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await admin.from("profiles").select("organization_id, full_name").eq("user_id", user.id).maybeSingle();
    const org = prof?.organization_id;
    if (!org) return json({ error: "Your account is not linked to a company." }, 400);
    const { data: settings } = await admin.from("ai_settings").select("ai_enabled, ai_model, chat_enabled, morning_brief_enabled").eq("organization_id", org).maybeSingle();
    if (settings && settings.ai_enabled === false) return json({ error: "AI is switched off for your company." });
    if (settings && settings.chat_enabled === false) return json({ error: "Ask Aothr is switched off for your company." });
    const { data: keyRow } = await admin.from("ai_provider_keys").select("openai_api_key").eq("organization_id", org).maybeSingle();
    const key = keyRow?.openai_api_key;
    if (!key) return json({ error: "No OpenAI key has been added for your company yet. Ask your admin to add it under Administration → Branding." });
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
- When the user asks about specific records (names, items, suppliers, dates, how many days), call the detail tools (e.g. ai_purchase_order_details, ai_vendor_directory) instead of repeating summary totals. Never say information is unavailable before checking the detail tools.
- Answer the exact question asked. Don't pad with unrelated figures.
- "Open" purchase orders means approved, sent or partially received only. Never add rejected, draft or cancelled POs into open totals.
- If a name isn't found among suppliers, check customers too (and vice versa) before saying it doesn't exist. Never list unrelated records as a substitute.
- "Revenue lines", "income lines" or "ledgers" means income accounts (ai_revenue_by_account), not months.
- For questions about an individual's pay or top earners, call ai_payroll_employee_detail. If it returns an access error, say the user's role doesn't allow viewing individual pay. Never describe a payroll total as one person's salary.
- Respect the time period asked. If the user names a month (e.g. "September 2026"), use that month's figures from the monthly breakdowns, not year-to-date totals. Only give YTD when asked or when no period is named, and label the period clearly.
- Use a list or small markdown table when showing several records.
- Amounts are Nigerian Naira; write them like ₦12.5M or ₦850,000.
- For broad CEO questions (how is the business doing, biggest issues, risks, what to focus on, what changed, improving or worse, three things to investigate), call several tools together: ai_business_health, ai_business_alerts, ai_profit_loss_monthly, ai_cash_outlook, ai_receivables, ai_cost_breakdown, and ai_revenue_breakdown. Rank issues by money at stake and back every point with a figure.
- For "this month vs last month", use the latest two months in monthly breakdowns and say if the current month is still in progress.
- For "why" questions, explain using the biggest movements in revenue by customer/product and costs by account; never guess causes the data does not show.
- Be concise and practical: short answer first, then key figures as a short bullet list, then one suggested action when useful.
- Deepen the conversation: after answering, end with ONE short, specific follow-up offer that naturally continues the topic (e.g. after listing upcoming payments: "Would you like me to rank these by urgency?"). Make the offer relevant to what was just answered, not generic.
- If the user agrees to a follow-up (says yes, sure, go ahead, etc.), deliver it immediately using the data available: rank, break down or drill into the items by amount, overdue status, due date, supplier/customer importance or cash impact — whichever data points the tools actually provide. Call the detail tools again if you need more. Never promise an analysis you cannot produce from the data.
- Only offer a follow-up when there is a genuinely useful next step; skip it for simple factual answers.
- Ask before answering when the question is ambiguous and the answer would differ by interpretation: ask ONE short clarifying question (e.g. "Do you mean this month or year to date?", "Suppliers or customers?", "All departments or one?"). Offer 2-3 likely options when you can. Only ask when the ambiguity really changes the answer; otherwise answer with the most reasonable interpretation and state which one you used.
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
        if (res.status === 401) return json({ error: "Your company's OpenAI key was rejected. Ask your admin to check or replace it." });
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

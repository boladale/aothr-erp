import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transactions, statementEndBalance, glBalance, statementStartDate, statementEndDate } = await req.json();

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ suggestedIds: [], reasoning: "No transactions to analyze." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txnSummary = transactions.map((t: any, i: number) => 
      `${i + 1}. ID:${t.id} | Date:${t.transaction_date} | Type:${t.transaction_type} | Amount:${t.amount} | Desc:"${t.description || ''}" | Payee:"${t.payee || ''}" | Ref:"${t.reference || ''}"`
    ).join("\n");

    const systemPrompt = `You are a bank reconciliation assistant for an ERP system. Your job is to analyze unreconciled bank transactions and suggest which ones should be marked as reconciled for a given statement period.

Rules for selecting transactions:
1. Only select transactions whose dates fall within or near the statement period (${statementStartDate} to ${statementEndDate})
2. Look for matching patterns: similar descriptions, references, amounts that together approach the difference between statement balance and GL balance
3. Group related transactions (e.g., "SALARY" entries, "TRANSFER" entries)
4. Prefer transactions with clear descriptions over ambiguous ones
5. The goal is to minimize the difference: Statement Balance (${statementEndBalance}) - GL Balance (${glBalance}) - Sum of selected = 0

Return a JSON object with:
- "suggestedIds": array of transaction IDs to select
- "reasoning": brief explanation of why these were selected`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are the unreconciled transactions:\n\n${txnSummary}\n\nAnalyze and suggest which transactions to reconcile.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_reconciliation",
            description: "Suggest which bank transactions should be reconciled",
            parameters: {
              type: "object",
              properties: {
                suggestedIds: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of transaction IDs to select for reconciliation"
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation of why these transactions were selected"
                }
              },
              required: ["suggestedIds", "reasoning"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_reconciliation" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ suggestedIds: [], reasoning: "Could not determine matches." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-reconcile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

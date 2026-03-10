import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id } = await req.json();

    if (!target_user_id || !action) {
      return new Response(JSON.stringify({ error: "action and target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-action
    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot perform this action on yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate" || action === "activate") {
      const isActive = action === "activate";
      const { error } = await adminClient
        .from("profiles")
        .update({ is_active: isActive })
        .eq("user_id", target_user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: `User ${isActive ? "activated" : "deactivated"}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Check if user has posted or approved any transactions
      const tables = [
        { table: "purchase_orders", col: "approved_by" },
        { table: "goods_receipts", col: "posted_by" },
        { table: "ap_invoices", col: "posted_by" },
        { table: "ap_payments", col: "posted_by" },
        { table: "ar_invoices", col: "posted_by" },
        { table: "ar_receipts", col: "posted_by" },
        { table: "ar_credit_notes", col: "posted_by" },
        { table: "gl_journal_entries", col: "posted_by" },
        { table: "fund_transfers", col: "posted_by" },
        { table: "delivery_notes", col: "posted_by" },
      ];

      // Also check created_by for key documents
      const createdByTables = [
        "purchase_orders",
        "goods_receipts",
        "ap_invoices",
        "ap_payments",
        "requisitions",
        "vendors",
      ];

      let hasTransactions = false;

      // Check posted_by / approved_by columns
      for (const { table, col } of tables) {
        const { count } = await adminClient
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq(col, target_user_id)
          .limit(1);
        if (count && count > 0) {
          hasTransactions = true;
          break;
        }
      }

      // Check created_by columns
      if (!hasTransactions) {
        for (const table of createdByTables) {
          const { count } = await adminClient
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("created_by", target_user_id)
            .limit(1);
          if (count && count > 0) {
            hasTransactions = true;
            break;
          }
        }
      }

      if (hasTransactions) {
        return new Response(
          JSON.stringify({ error: "Cannot delete user: they have posted or created transactions. Use deactivate instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete user roles, profile, then auth user
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
      await adminClient.from("notifications").delete().eq("user_id", target_user_id);
      await adminClient.from("profiles").delete().eq("user_id", target_user_id);
      
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true, message: "User deleted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-manage-user error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

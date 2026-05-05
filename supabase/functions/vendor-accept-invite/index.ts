import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { token, email, password, contact_name } = await req.json();
    if (!token || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate token
    const { data: invite, error: inviteErr } = await admin
      .from("vendor_invite_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite link" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Look up existing auth user by email
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());

    if (existing) {
      // Update password & confirm email
      userId = existing.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: contact_name || existing.user_metadata?.full_name },
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: contact_name },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // 3. Link vendor_users (idempotent)
    const { data: existingLink } = await admin
      .from("vendor_users")
      .select("id")
      .eq("user_id", userId)
      .eq("vendor_id", invite.vendor_id)
      .maybeSingle();
    if (!existingLink) {
      await admin.from("vendor_users").insert({
        user_id: userId,
        vendor_id: invite.vendor_id,
        is_active: true,
      });
    }

    // 4. Add vendor_user role (idempotent)
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "vendor_user")
      .maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: userId, role: "vendor_user" });
    }

    // 5. Mark token used
    await admin
      .from("vendor_invite_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("vendor-accept-invite error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

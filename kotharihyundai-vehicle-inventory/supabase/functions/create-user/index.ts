import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function usernameEmail(username: string) {
  return `${username.toLowerCase().trim()}@login.kotharihyundai.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: caller }, error: callerError } =
      await callerClient.auth.getUser();

    if (callerError || !caller) throw new Error("Not authenticated.");

    const adminClient = createClient(supabaseUrl, serviceRole);

    const { data: callerProfile } = await adminClient
      .from("user_profiles")
      .select("active, roles(name)")
      .eq("id", caller.id)
      .maybeSingle();

    if (
      !callerProfile?.active ||
      String(callerProfile.roles?.name || "").toLowerCase() !== "admin"
    ) {
      return new Response(
        JSON.stringify({ error: "Admin permission required." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    const username = String(body.username || "")
      .trim()
      .toLowerCase();

    const full_name = String(body.full_name || "").trim();
    const password = String(body.password || "");
    const role_id = body.role_id || null;
    const location_id = body.location_id || null;
    const active = body.active !== false;

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new Error(
        "Username must be 3-30 characters: a-z, 0-9, dot, underscore or hyphen."
      );
    }

    if (!full_name || !password || !role_id) {
      throw new Error("Username, full name, password and role are required.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) throw new Error("Username already exists.");

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email: usernameEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, full_name }
      });

    if (createError) throw createError;

    const { error: insertError } =
      await adminClient.from("user_profiles").insert({
        id: created.user.id,
        username,
        full_name,
        role_id,
        location_id,
        active
      });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: created.user.id, username, full_name }
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

<<<<<<< HEAD
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const normalizeUsername = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server configuration is missing." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  // Verify the logged-in caller using the caller's JWT.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: "Invalid or expired admin session." }, 401);
  }

  const callerId = userData.user.id;

  // Check the caller's real Supabase profile. Admin is the role name; username is not used for authorization.
  const { data: callerProfile, error: profileError } = await authClient
    .from("user_profiles")
    .select("id, username, active, role_id, roles(name)")
    .eq("id", callerId)
    .maybeSingle();

  if (profileError) {
    console.error("Caller profile error:", profileError);
    return json({ error: `Unable to verify admin profile: ${profileError.message}` }, 500);
  }

  const callerRole = String(callerProfile?.roles?.name ?? "").trim().toLowerCase();
  const isAdmin = callerProfile?.active === true && callerRole === "admin";

  if (!isAdmin) {
    return json({ error: "Admin access required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const username = normalizeUsername(body.username);
  const fullName = String(body.full_name ?? "").trim();
  const password = String(body.password ?? "");
  const roleId = String(body.role_id ?? "").trim();
  const locationIdRaw = body.location_id;
  const locationId = locationIdRaw ? String(locationIdRaw).trim() : null;
  const active = body.active !== false;

  if (!username || !fullName || !password || !roleId) {
    return json({ error: "Username, full name, password and role are required." }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return json({ error: "Username must contain only letters, numbers, dot, underscore or hyphen." }, 400);
  }

  // Validate role.
  const { data: role, error: roleError } = await authClient
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .maybeSingle();
  if (roleError || !role) return json({ error: "Selected role is invalid." }, 400);

  // Validate location when one is selected. NULL means All Locations.
  if (locationId) {
    const { data: location, error: locationError } = await authClient
      .from("locations")
      .select("id, location_name, location_code, active")
      .eq("id", locationId)
      .maybeSingle();

    if (locationError || !location) return json({ error: "Selected location is invalid." }, 400);
    if (location.active === false) return json({ error: "Selected location is inactive." }, 400);
  }

  // Username must be unique in user_profiles.
  const { data: existingProfile } = await authClient
    .from("user_profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existingProfile) return json({ error: "Username already exists." }, 409);

  // Frontend intentionally has no phone field. Auth uses an internal synthetic email.
  const authEmail = `${username}@login.kotharihyundai.local`;

  const { data: created, error: createError } = await authClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
    },
  });

  if (createError || !created.user) {
    console.error("Auth create error:", createError);
    return json({ error: createError?.message || "Unable to create authentication user." }, 400);
  }

  const newUserId = created.user.id;

  const { data: profile, error: insertError } = await authClient
    .from("user_profiles")
    .insert({
      id: newUserId,
      username,
      full_name: fullName,
      role_id: roleId,
      location_id: locationId,
      active,
    })
    .select("id, username, full_name, role_id, location_id, active")
    .single();

  if (insertError) {
    // Roll back the Auth user if profile creation fails.
    await authClient.auth.admin.deleteUser(newUserId);
    console.error("Profile insert error:", insertError);
    return json({ error: `Unable to save user profile: ${insertError.message}` }, 400);
  }

  // Optional audit log: use the table only if it exists; do not fail user creation because of audit logging.
  try {
    await authClient.from("audit_logs").insert({
      actor_id: callerId,
      action: "CREATE_USER",
      entity_type: "user_profiles",
      entity_id: newUserId,
      details: {
        username,
        full_name: fullName,
        role: role.name,
        location_id: locationId,
        active,
      },
    });
  } catch (auditError) {
    console.warn("Audit log insert skipped:", auditError);
  }

  return json({
    success: true,
    user: profile,
    auth_email: authEmail,
  }, 201);
=======
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
>>>>>>> 35b8dd20af11753bea1d70bbd6aa97a7092a981e
});

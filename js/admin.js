"use strict";
/* ADMIN: users, permissions, roles, status, audit, settings */
async function renderAdmin(page){
  const sb = state.supabase, c = $("content");
  const head = t => `<div class="panel-head"><h3>${esc(t)}</h3></div>`;
  if(page === "users"){
    c.innerHTML = `<div class="panel">${head("Create User")}<form id="createUserForm" class="form-grid">
      <div><label>USERNAME</label><input name="username" required placeholder="accounts01"></div>
      <div><label>FULL NAME</label><input name="full_name" required></div>
      <div><label>PASSWORD</label><input name="password" required type="password" minlength="6" maxlength="12" placeholder="6 to 12 characters"></div>
      <div><label>ROLE</label><select name="role_id" id="newUserRole" required></select></div>
      <div><label>LOCATION</label><select name="location_id" id="newUserLocation"></select></div>
      <div><label>STATUS</label><select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></div>
      <div class="full form-actions"><button class="primary-btn" type="submit">Create User</button></div></form><div id="createUserMessage" class="message"></div></div>
      <div class="panel"><div class="panel-head"><h3>Users</h3></div><div id="usersTable" class="table-wrap"></div></div>`;
    const [roles, locs] = await Promise.all([sb.from("roles").select("id,name").order("name"), getLocations()]);
    $("newUserRole").innerHTML = `<option value="">Select role</option>` + (roles.data||[]).map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    $("newUserLocation").innerHTML = `<option value="">All Locations</option>` + locs.filter(l => l.active !== false).map(l => `<option value="${esc(l.id)}">${esc(l.location_name)}</option>`).join("");
    $("createUserForm").addEventListener("submit", createUser);
    return loadUsers();
  }
  if(page === "assign-roles" || page === "user-status") return renderUserEditor(page);
  if(page === "permissions") return renderPermissions();
  if(page === "audit"){
    const r = await sb.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(200);
    c.innerHTML = `<div class="panel">${head("Audit Logs")}<div class="table-wrap">${r.error ? emptyState(r.error.message) :
      table(["Time","User","Action","Module","Entity","Details"], (r.data||[]).map(x => [fmtDT(x.created_at),x.actor_username,x.action,x.module,x.entity_type,x.details]))}</div></div>`;
    return;
  }
  if(page === "locations"){
    const l = await getLocations(true);
    c.innerHTML = `<div class="panel">${head("Locations")}<div class="table-wrap">${table(["Location","Code","Active"], l.map(x => [x.location_name,x.location_code,x.active===false?"No":"Yes"]))}</div></div>`;
    return;
  }
  const t = {company:"Company","import-config":"Import Configuration","system-settings":"System Settings"}[page] || "Settings";
  c.innerHTML = `<div class="panel">${head(t)}<div class="notice"><b>Kothari Hyundai</b><p>No configurable options are defined for this section yet.</p></div></div>`;
}
async function createUser(e){
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target).entries()), msg = $("createUserMessage");
  const say = (t, cls) => { msg.textContent = t; msg.className = "message " + (cls||""); };
  if(f.password.length < 6 || f.password.length > 12) return say("Password must be 6 to 12 characters.","error");
  const {data:{session}} = await state.supabase.auth.getSession();
  if(!session) return say("Session expired. Please login again.","error");
  say("Creating user…");
  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/create-user`, {method:"POST",
      headers:{"Content-Type":"application/json", "Authorization":`Bearer ${session.access_token}`, "apikey":SUPABASE_CONFIG.anonKey},
      body:JSON.stringify({username:normalizeUsername(f.username), full_name:f.full_name.trim(), password:f.password, role_id:f.role_id, location_id:f.location_id||null, active:f.active==="true"})});
    const out = await res.json().catch(() => ({}));
    if(!res.ok) return say(out.error || "Unable to create user.","error");
    say(`User ${out.user?.username || f.username} created.`,"success"); e.target.reset(); logAudit("CREATE_USER","users","user",out.user?.id,{username:f.username}); loadUsers();
  } catch { say("Cannot reach the create-user function. Is it deployed?","error"); }
}
async function loadUsers(){
  if(!$("usersTable")) return;
  await getLocations();
  const r = await state.supabase.from("user_profiles").select("username,full_name,active,created_at,roles(name),location_id").order("created_at",{ascending:false});
  $("usersTable").innerHTML = r.error ? emptyState(r.error.message) :
    table(["Username","Name","Role","Location","Status","Created"], (r.data||[]).map(x => [x.username,x.full_name,x.roles?.name,x.location_id?locName(x.location_id):"All Locations",statusBadge(x.active===false?"Inactive":"Active"),fmtDT(x.created_at)]));
}
async function renderUserEditor(page){
  const sb = state.supabase, byRole = page === "assign-roles";
  const [u, roles] = await Promise.all([sb.from("user_profiles").select("id,username,full_name,active,role_id,roles(name)").order("username"), sb.from("roles").select("id,name").order("name")]);
  if(u.error) { $("content").innerHTML = `<div class="panel">${emptyState(u.error.message)}</div>`; return; }
  const opts = id => (roles.data||[]).map(r => `<option value="${esc(r.id)}" ${r.id===id?"selected":""}>${esc(r.name)}</option>`).join("");
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>${byRole?"Assign Roles":"User Status"}</h3></div><div class="table-wrap"><table><thead><tr><th>Username</th><th>Name</th><th>${byRole?"Role":"Status"}</th></tr></thead><tbody>${
    (u.data||[]).map(x => `<tr><td>${esc(x.username)}</td><td>${esc(x.full_name||"-")}</td><td>${byRole ?
      `<select data-uid="${esc(x.id)}">${opts(x.role_id)}</select>` :
      `<select data-uid="${esc(x.id)}"><option value="true" ${x.active!==false?"selected":""}>Active</option><option value="false" ${x.active===false?"selected":""}>Inactive</option></select>`}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("content").querySelectorAll("select[data-uid]").forEach(s => s.addEventListener("change", async () => {
    const patch = byRole ? {role_id:s.value} : {active:s.value==="true"};
    if(state.user?.id === s.dataset.uid && !byRole && !patch.active){ toast("You cannot deactivate yourself.","error"); return renderUserEditor(page); }
    const {error} = await sb.from("user_profiles").update(patch).eq("id", s.dataset.uid);
    if(error) toast(error.message,"error"); else { toast("Saved."); logAudit("UPDATE_USER","users","user",s.dataset.uid,patch); }
  }));
}
async function renderPermissions(){
  const sb = state.supabase;
  const [roles, perms, rp] = await Promise.all([sb.from("roles").select("id,name").order("name"), sb.from("permissions").select("id,code,description").order("code"), sb.from("role_permissions").select("role_id,permission_id")]);
  const err = roles.error || perms.error || rp.error;
  if(err){ $("content").innerHTML = `<div class="panel">${emptyState(err.message)}</div>`; return; }
  const has = new Set((rp.data||[]).map(x => x.role_id + "|" + x.permission_id));
  const editable = (roles.data||[]).filter(r => String(r.name).toLowerCase() !== "admin");
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>Permissions</h3></div><p class="form-help">Admin always has full access. Tick to allow; changes save instantly.</p><div class="table-wrap"><table><thead><tr><th>Permission</th>${editable.map(r => `<th>${esc(r.name)}</th>`).join("")}</tr></thead><tbody>${
    (perms.data||[]).map(p => `<tr><td title="${esc(p.description||"")}">${esc(p.code)}</td>${editable.map(r => `<td><input type="checkbox" data-r="${esc(r.id)}" data-p="${esc(p.id)}" ${has.has(r.id+"|"+p.id)?"checked":""}></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  $("content").querySelectorAll("input[data-r]").forEach(cb => cb.addEventListener("change", async () => {
    const q = cb.checked ? sb.from("role_permissions").insert({role_id:cb.dataset.r, permission_id:cb.dataset.p})
                         : sb.from("role_permissions").delete().eq("role_id",cb.dataset.r).eq("permission_id",cb.dataset.p);
    const {error} = await q;
    if(error){ toast(error.message,"error"); cb.checked = !cb.checked; } else logAudit("PERMISSION","permissions","role",cb.dataset.r,{permission:cb.dataset.p, allowed:cb.checked});
  }));
}

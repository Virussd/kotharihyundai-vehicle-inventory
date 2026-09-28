const MENU = [
  {section:"MAIN", items:[["dashboard","Dashboard","▦"]], collapsible:false},
  {section:"VEHICLE MANAGEMENT", items:[
    ["vehicles","Vehicle Stock","▤"],["search","Search by Chassis / VIN","⌕"],
    ["status","Current Status","◉"],["timeline","View Timeline","◷"]
  ]},
  {section:"DATA IMPORT", items:[
    ["order-import","Order Report Import","⇧"],["purchase-import","Purchase Report Import","⇧"],
    ["sales-import","Sales Report Import","⇧"],["import-history","Import History","≡"]
  ]},
  {section:"GATE MANAGEMENT", items:[
    ["bhilarwadi","Bhilarwadi In / Out","⇄"],["gate","Vehicle In / Out","⇄"],
    ["bulk-gate","Bulk Vehicle In / Out","⇄"],["gate-pass","Gate Pass","▣"],["register","In-Out Register","☷"]
  ]},
  {section:"DELIVERY", items:[
    ["delivery-entry","Delivery Entry","✓"],["delivered","Delivered Vehicles","✓"],["delivery-history","Delivery History","◷"]
  ]},
  {section:"REPORTS", items:[
    ["dashboard-report","Dashboard Report","▥"],["location-report","Location Stock","▥"],["model-report","Model Stock","▥"],
    ["finance-report","Finance-wise Stock","₹"],["aging-report","Aging Report","◴"],["delivery-report","Delivery Report","✓"],
    ["pending-report","Pending Order Report","!"],["transit-report","In Transit Report","→"],["gate-report","Gate Movement Report","⇄"],
    ["dealer-report","Dealer Code-wise Stock","▥"]
  ]},
  {section:"ADMINISTRATION", items:[
    ["users","Create Users & Roles","♙"],["permissions","Permissions","⚿"],
    ["assign-roles","Assign Roles","↔"],["user-status","User Status","●"],["audit","Audit Logs","⌁"]
  ]},
  {section:"SETTINGS", items:[
    ["company","Company","⌂"],["locations","Locations","⌖"],
    ["import-config","Import Configuration","⚙"],["system-settings","System Settings","⚙"]
  ]}
];

const state = {page:"dashboard", user:null, profile:null, role:"", supabase:null, connected:false};

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function supabaseReady() {
  return window.SUPABASE_CONFIG &&
    !window.SUPABASE_CONFIG.url.startsWith("YOUR_") &&
    !window.SUPABASE_CONFIG.anonKey.startsWith("YOUR_") &&
    window.supabase;
}

async function init() {
  renderNav();
  if (supabaseReady()) {
    state.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    state.connected = true;
    setConnection(true);
    const {data:{session}} = await state.supabase.auth.getSession();
    if (session) showApp(session.user);
    state.supabase.auth.onAuthStateChange((_event, session) => session ? showApp(session.user) : showLogin());
  } else {
    setConnection(false);
  }
  $("loginForm").addEventListener("submit", login);
  bindAuthUI();
  $("logoutBtn").addEventListener("click", logout);
  $("refreshBtn").addEventListener("click", () => loadPage(state.page));
  $("mobileMenu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
}

function setConnection(ok) {
  $("connectionDot").className = "dot " + (ok ? "online" : "offline");
  $("connectionText").textContent = ok ? "Supabase connected" : "Supabase not configured";
}

function renderNav() {
  $("nav").innerHTML = MENU.map((group, gi) => {
    const key = `nav-open-${gi}`;
    const collapsible = group.collapsible !== false;
    return `<div class="nav-group ${collapsible ? "nav-collapsible" : ""}" data-nav-group="${key}">
      <button class="nav-label nav-label-btn" type="button" data-nav-toggle="${key}" ${collapsible ? "" : "disabled"}>
        <span>${group.section}</span>${collapsible ? '<span class="nav-chevron">⌄</span>' : ''}
      </button>
      <div class="nav-submenu" data-nav-submenu="${key}">
        ${group.items.map(([id,label,icon]) => `<button class="nav-item" data-page="${id}"><span>${icon}</span><span class="nav-item-text">${label}</span></button>`).join("")}
      </div>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-nav-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.navToggle;
      const group = document.querySelector(`[data-nav-group="${key}"]`);
      if (!group) return;
      group.classList.toggle("collapsed");
      localStorage.setItem(key, group.classList.contains("collapsed") ? "0" : "1");
    });
    const key = btn.dataset.navToggle;
    const saved = localStorage.getItem(key);
    const group = document.querySelector(`[data-nav-group="${key}"]`);
    if (saved === "0") group?.classList.add("collapsed");
  });

  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => {
    state.page=b.dataset.page;
    const parent=b.closest(".nav-group");
    parent?.classList.remove("collapsed");
    document.querySelector(".sidebar").classList.remove("open");
    loadPage(state.page);
  }));
}

async function login(e) {
  e.preventDefault();
  const username = normalizeUsername($("username").value);
  const password = $("password").value;

  if (!state.supabase) {
    $("loginMessage").textContent = "Supabase is not configured. Add your project URL and publishable key in js/config.js.";
    $("loginMessage").className="message error";
    return;
  }
  if (!username || !password) {
    $("loginMessage").textContent = "Enter username and password.";
    $("loginMessage").className="message error";
    return;
  }

  $("loginMessage").textContent="Signing in...";
  $("loginMessage").className="message";

  const email = usernameToAuthEmail(username);
  const {data,error}=await state.supabase.auth.signInWithPassword({email,password});

  if(error){
    $("loginMessage").textContent="Invalid username or password.";
    $("loginMessage").className="message error";
    return;
  }
  showApp(data.user);
}

async function logout(){
  if(state.supabase) await state.supabase.auth.signOut();
  showLogin();
}

function showLogin(){
  $("loginView").classList.remove("hidden");
  if ($("resetView")) $("resetView").classList.add("hidden");
  $("appView").classList.add("hidden");
}

async function showApp(user){
  state.user=user;
  $("loginView").classList.add("hidden");
  if ($("resetView")) $("resetView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  let displayName = user.user_metadata?.full_name || user.user_metadata?.username || (user.email === "shubhamdamajighar6987@gmail.com" ? "Administrator" : "User");
  try {
    const p=await state.supabase.from("user_profiles")
      .select("username,full_name,active,roles(name)")
      .eq("id",user.id).maybeSingle();

    if(p.error) console.warn(p.error.message);
    if(p.data){
      if(p.data.active === false){
        await state.supabase.auth.signOut();
        $("loginMessage").textContent="This user is inactive. Contact Admin.";
        $("loginMessage").className="message error";
        showLogin();
        return;
      }
      displayName=p.data.full_name || p.data.username || displayName;
      state.profile=p.data;
      state.role=p.data.roles?.name || "";
    }
  } catch(err) {
    console.warn(err);
  }

  $("userName").textContent=displayName;
  loadPage("dashboard");
}

function navActive(){document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===state.page));}

function normalizeUsername(v){
  return String(v||"").trim().toLowerCase().replace(/\s+/g,"");
}

function normalizePhone(v){
  let p=String(v||"").replace(/[^\d+]/g,"");
  if(p.startsWith("0") && p.length===11) p="+91"+p.slice(1);
  if(/^\d{10}$/.test(p)) p="+91"+p;
  if(p.startsWith("91") && p.length===12) p="+"+p;
  return p;
}

function usernameToAuthEmail(username){
  const u = normalizeUsername(username);

  // Current Kothari Hyundai Admin Auth account
  if (u === "admin") {
    return "shubhamdamajighar6987@gmail.com";
  }

  // Users created through the Create User Edge Function
  return `${u}@login.kotharihyundai.local`;
}

async function startPasswordReset(){
  const username=normalizeUsername($("resetUsername").value);

  if(!state.supabase){setResetMessage("Supabase is not configured.","error");return;}
  if(!username){setResetMessage("Enter your username.","error");return;}

  $("sendOtpBtn").disabled=true;
  setResetMessage("Checking account and sending OTP to the registered mobile...","");

  try {
    const response=await fetch(`${SUPABASE_CONFIG.url}/functions/v1/send-reset-otp`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_CONFIG.anonKey
      },
      body:JSON.stringify({username})
    });

    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      setResetMessage(result.error||"Unable to send OTP.","error");
      $("sendOtpBtn").disabled=false;
      return;
    }

    $("resetStep1").classList.add("hidden");
    $("resetStep2").classList.remove("hidden");
    setResetMessage("OTP sent to the registered mobile number.","success");
  } catch(err) {
    setResetMessage("Unable to connect to password reset service.","error");
  } finally {
    $("sendOtpBtn").disabled=false;
  }
}

async function completePasswordReset(){
  const username=normalizeUsername($("resetUsername").value);
  const token=$("resetOtp").value.trim();
  const password=$("resetPassword").value;
  const confirm=$("resetPasswordConfirm").value;

  if(!username || !token || !password || !confirm){
    setResetMessage("Enter username, OTP and new password.","error"); return;
  }
  if(password.length<8){
    setResetMessage("Password must be at least 8 characters.","error"); return;
  }
  if(password!==confirm){
    setResetMessage("Passwords do not match.","error"); return;
  }

  $("resetPasswordBtn").disabled=true;
  setResetMessage("Verifying OTP and updating password...","");

  try {
    const response=await fetch(`${SUPABASE_CONFIG.url}/functions/v1/reset-password-with-otp`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":SUPABASE_CONFIG.anonKey
      },
      body:JSON.stringify({username,token,password})
    });

    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      setResetMessage(result.error||"Invalid OTP or unable to reset password.","error");
      return;
    }

    $("resetStep2").classList.add("hidden");
    $("resetStep1").classList.remove("hidden");
    $("resetOtp").value="";
    $("resetPassword").value="";
    $("resetPasswordConfirm").value="";
    $("resetUsername").value="";
    setResetMessage("Password reset successfully. You can now login with your username and new password.","success");
    setTimeout(showLogin,1500);
  } catch(err) {
    setResetMessage("Unable to connect to password reset service.","error");
  } finally {
    $("resetPasswordBtn").disabled=false;
  }
}

function setResetMessage(text,type){
  $("resetMessage").textContent=text;
  $("resetMessage").className="message"+(type?" "+type:"");
}

function openReset(){
  $("loginView").classList.add("hidden");
  $("appView").classList.add("hidden");
  $("resetView").classList.remove("hidden");
  $("resetMessage").textContent="";
}

function bindAuthUI(){
  if($("forgotPasswordBtn")) $("forgotPasswordBtn").addEventListener("click",openReset);
  if($("backToLoginBtn")) $("backToLoginBtn").addEventListener("click",showLogin);
  if($("sendOtpBtn")) $("sendOtpBtn").addEventListener("click",startPasswordReset);
  if($("resetPasswordBtn")) $("resetPasswordBtn").addEventListener("click",completePasswordReset);
}

async function loadPage(page) {
  navActive();
  const item = MENU.flatMap(x=>x.items).find(x=>x[0]===page);
  $("pageTitle").textContent=item?.[1] || "Dashboard";
  $("pageSubtitle").textContent = "Hyundai Vehicle Inventory System";
  if(page==="dashboard") return renderDashboard();
  if(page==="vehicles"||page==="search"||page==="status") return renderVehicles(page);
  if(page==="timeline") return renderTimeline();
  if(page.includes("import")) return renderImport(page);
  if(["bhilarwadi","gate","bulk-gate","gate-pass","register"].includes(page)) return renderGate(page);
  if(page.includes("delivery")) return renderDelivery(page);
  if(page.includes("report")) return renderReport(page);
  return renderAdmin(page);
}

function renderDashboard(){
  $("content").innerHTML=`
  <div class="cards dashboard-cards">
    ${[["Total Order Stock","stat0"],["Available Stock","stat1"],["In Transit","stat2"],["Pending Order","stat3"],["Bill / Not Delivered","stat4"],["Delivered","stat5"]].map(([x,id])=>`
      <button class="stat-card stat-card-button" onclick="loadPage('dashboard-report')">
        <div class="stat-title">${x}</div><div class="stat-value" id="${id}">0</div><div class="stat-note">Live Supabase data • Click for report</div>
      </button>`).join("")}
  </div>
  <div class="grid-2">
    <div class="panel"><div class="panel-head"><h3>Available Stock – Finance-wise</h3><button class="secondary-btn" onclick="loadPage('finance-report')">View Report</button></div><div id="financeDash" class="table-wrap">${emptyState("Loading...")}</div></div>
    <div class="panel"><div class="panel-head"><h3>Available Stock – Dealer Code-wise</h3><button class="secondary-btn" onclick="loadPage('dealer-report')">View Report</button></div><div id="dealerDash" class="table-wrap">${emptyState("Loading...")}</div></div>
  </div>
  <div class="grid-2">
    <div class="panel"><div class="panel-head"><h3>Status-wise Stock</h3><button class="secondary-btn" onclick="loadPage('dashboard-report')">View Report</button></div><div id="statusDash" class="status-summary">${emptyState("Loading...")}</div></div>
    <div class="panel"><div class="panel-head"><h3>Recent Vehicle Movements</h3><button class="secondary-btn" onclick="loadPage('gate-report')">View All</button></div><div id="gateTable" class="table-wrap">${emptyState("Loading...")}</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Location-wise Stock & Value</h3><button class="secondary-btn" onclick="loadPage('location-report')">View Report</button></div><div id="locationTable" class="table-wrap">${emptyState("Loading...")}</div></div>
  <div class="panel"><div class="panel-head"><h3>Model-wise Stock & Value</h3><button class="secondary-btn" onclick="loadPage('model-report')">View Report</button></div><div id="modelDash" class="table-wrap">${emptyState("Loading...")}</div></div>`;
  if(state.supabase) loadDashboardData();
}

async function loadDashboardData(){
  const sb=state.supabase;
  if(!sb)return;

  // Dashboard summary. If the optional summary view is unavailable,
  // calculate the six cards directly from vehicles so the dashboard
  // does not break.
  const summary=await sb.from("dashboard_stock_summary").select("*").maybeSingle();
  if(!summary.error && summary.data){
    const d=summary.data;
    const values=[
      d.total_order_stock ?? d.total_stock ?? 0,
      d.available_stock ?? 0,
      d.in_transit ?? 0,
      d.pending_order ?? 0,
      d.bill_not_delivered ?? 0,
      d.delivered ?? 0
    ];
    values.forEach((v,i)=>{
      const el=$("stat"+i);
      if(el)el.textContent=Number(v||0).toLocaleString("en-IN");
    });
  } else {
    const fallback=await sb.from("vehicles")
      .select("status,stock_value")
      .limit(10000);

    if(!fallback.error){
      const rows=fallback.data||[];
      const norm=v=>String(v||"").trim().toUpperCase().replace(/\s+/g,"_");
      const isAvailable=v=>["AVAILABLE","IN_STOCK","STOCK"].includes(norm(v));
      const isTransit=v=>["IN_TRANSIT","IN-TRANSIT","TRANSIT"].includes(norm(v));
      const isPending=v=>["PENDING_ORDER","PENDING","ORDER_PENDING"].includes(norm(v));
      const isBill=v=>["BILL_NOT_DELIVERED","BILLED_NOT_DELIVERED","BILL_NOT_DELIVERED_"].includes(norm(v));
      const isDelivered=v=>["DELIVERED","DELIVERY"].includes(norm(v));

      const counts=[
        rows.length,
        rows.filter(v=>isAvailable(v.status)).length,
        rows.filter(v=>isTransit(v.status)).length,
        rows.filter(v=>isPending(v.status)).length,
        rows.filter(v=>isBill(v.status)).length,
        rows.filter(v=>isDelivered(v.status)).length
      ];
      counts.forEach((v,i)=>{
        const el=$("stat"+i);
        if(el)el.textContent=Number(v||0).toLocaleString("en-IN");
      });
    }
  }

  const [loc,fin,dealer,model,gate]=await Promise.all([
    sb.from("location_stock_report").select("*").order("vehicle_count",{ascending:false}).limit(100),
    sb.from("finance_stock_report").select("*").order("vehicle_count",{ascending:false}).limit(100),
    sb.from("dealer_code_stock_report").select("*").order("vehicle_count",{ascending:false}).limit(100),
    sb.from("model_stock_report").select("*").order("vehicle_count",{ascending:false}).limit(100),
    sb.from("gate_movement_report").select("*").order("movement_time",{ascending:false}).limit(8)
  ]);

  if($("locationTable")){
    $("locationTable").innerHTML=loc.error
      ? emptyState(friendlyDbError(loc.error))
      : table(["Location","Vehicles","Stock Value"],(loc.data||[]).map(r=>[
          r.location_name,r.vehicle_count,money(r.stock_value)
        ]));
  }

  if($("financeDash")){
    $("financeDash").innerHTML=fin.error
      ? emptyState(friendlyDbError(fin.error))
      : table(["Finance","Vehicles","Stock Value"],(fin.data||[]).map(r=>[
          r.finance_company||"Not Financed",r.vehicle_count,money(r.stock_value)
        ]));
  }

  if($("dealerDash")){
    $("dealerDash").innerHTML=dealer.error
      ? emptyState(friendlyDbError(dealer.error))
      : table(["Dealer Code","Vehicles","Stock Value"],(dealer.data||[]).map(r=>[
          r.dealer_code||"-",r.vehicle_count,money(r.stock_value)
        ]));
  }

  if($("modelDash")){
    $("modelDash").innerHTML=model.error
      ? emptyState(friendlyDbError(model.error))
      : table(["Model","Vehicles","Stock Value"],(model.data||[]).map(r=>[
          r.model||"-",r.vehicle_count,money(r.stock_value)
        ]));
  }

  if($("gateTable")){
    $("gateTable").innerHTML=gate.error
      ? emptyState(friendlyDbError(gate.error))
      : table(["Date","Type","VIN","Location"],(gate.data||[]).map(r=>[
          date(r.movement_time),r.movement_type,r.vin,
          r.to_location||r.from_location||"-"
        ]));
  }

  // Status-wise summary. Works directly from vehicles even when the
  // optional report view is unavailable.
  const vr=await sb.from("vehicles").select("status,stock_value").limit(10000);
  if($("statusDash")){
    if(vr.error){
      $("statusDash").innerHTML=emptyState(friendlyDbError(vr.error));
    }else{
      const groups={};
      (vr.data||[]).forEach(v=>{
        const k=String(v.status||"UNKNOWN").trim()||"UNKNOWN";
        groups[k]??={count:0,value:0};
        groups[k].count++;
        groups[k].value+=Number(v.stock_value||0);
      });

      const entries=Object.entries(groups).sort((a,b)=>b[1].count-a[1].count);
      const total=Math.max((vr.data||[]).length,1);

      $("statusDash").innerHTML=entries.length
        ? `<div class="status-pie-list">${entries.map(([k,v])=>{
            const pct=Math.round((v.count/total)*100);
            return `<button class="status-pie-row" onclick="loadPage('status')">
              <span class="status-dot"></span>
              <span class="status-name">${esc(k)}</span>
              <span class="status-bar"><i style="width:${pct}%"></i></span>
              <b>${v.count.toLocaleString("en-IN")}</b>
              <span>${money(v.value)}</span>
            </button>`;
          }).join("")}</div>`
        : emptyState("No stock data available.");
    }
  }
}

function friendlyDbError(result){
  const msg=String(result?.message||"Unable to load data.");
  if(/permission denied/i.test(msg)){
    return "Database permission denied. Run KOTHARI_PERMISSION_FIX.sql in Supabase SQL Editor.";
  }
  if(/does not exist/i.test(msg)){
    return "This report/view is not configured yet. Dashboard vehicle data can still be used.";
  }
  return msg;
}

async function renderVehicles(page){
  const title=page==="search"?"Search Vehicle":"Vehicle Stock";
  $("content").innerHTML=`
  <div class="toolbar"><div class="searchbox"><input id="vehicleSearch" placeholder="Search VIN / chassis / model / color"><button onclick="queryVehicles()">Search</button></div>
  <button class="primary-btn" onclick="openVehicleForm()">+ Add Vehicle</button></div>
  <div class="panel"><div class="table-wrap" id="vehicleResults">${emptyState("Enter a search or load live vehicle stock.")}</div></div>
  <div id="modal"></div>`;
  if(page!=="search") queryVehicles();
}
async function queryVehicles(){
  const q=($("vehicleSearch")?.value||"").trim();
  if(!state.supabase){$("vehicleResults").innerHTML=emptyState("Connect Supabase to load live vehicles.");return;}
  let query=state.supabase.from("vehicles").select("id,vin,chassis_no,model,variant,color,location_id,status,finance_company,stock_value,purchase_date").order("created_at",{ascending:false}).limit(100);
  if(q) query=query.or(`vin.ilike.%${q}%,chassis_no.ilike.%${q}%,model.ilike.%${q}%,color.ilike.%${q}%`);
  const {data,error}=await query;
  $("vehicleResults").innerHTML=error?emptyState(error.message):table(["VIN","Chassis","Model","Variant","Color","Status","Value"],(data||[]).map(v=>[`<b>${esc(v.vin)}</b>`,esc(v.chassis_no),esc(v.model),esc(v.variant),esc(v.color),`<span class="badge">${esc(v.status)}</span>`,money(v.stock_value)]));
}
function openVehicleForm(){
 $("modal").innerHTML=`<div class="modal-bg"><div class="modal"><div class="panel-head"><h3>Add Vehicle</h3><button class="icon-btn" onclick="closeModal()">×</button></div>
 <form id="vehicleForm" class="form-grid">
 ${["vin","chassis_no","engine_no","model","variant","color","fuel_type","transmission","order_no","dealer_code","finance_company"].map(x=>`<div><label>${x.replaceAll("_"," ").toUpperCase()}</label><input name="${x}" required="${x==="vin"}></div>`).join("")}
 <div><label>STOCK VALUE</label><input name="stock_value" type="number" step="0.01"></div>
 <div class="full"><label>REMARKS</label><textarea name="remarks"></textarea></div>
 <div class="full form-actions"><button type="button" class="secondary-btn" onclick="closeModal()">Cancel</button><button class="primary-btn">Save Vehicle</button></div></form></div></div>`;
 $("vehicleForm").addEventListener("submit",saveVehicle);
}
async function saveVehicle(e){
 e.preventDefault(); if(!state.supabase){alert("Connect Supabase first.");return;}
 const obj=Object.fromEntries(new FormData(e.target).entries()); obj.stock_value=Number(obj.stock_value||0);
 const {error}=await state.supabase.from("vehicles").insert(obj);
 if(error) alert(error.message); else {closeModal();queryVehicles();}
}
function closeModal(){$("modal").innerHTML="";}

function renderTimeline(){
 $("content").innerHTML=`<div class="panel"><div class="panel-head"><h3>Vehicle Timeline</h3><div class="searchbox"><input id="timelineVin" placeholder="Enter VIN"><button onclick="loadTimeline()">Search</button></div></div><div id="timelineResults">${emptyState("Search a VIN to view its read-only timeline.")}</div></div>`;
}
async function loadTimeline(){
 const vin=$("timelineVin").value.trim(); if(!vin||!state.supabase)return;
 const v=await state.supabase.from("vehicles").select("id,vin").eq("vin",vin).maybeSingle();
 if(!v.data){$("timelineResults").innerHTML=emptyState("Vehicle not found.");return;}
 const r=await state.supabase.from("vehicle_timeline").select("*").eq("vehicle_id",v.data.id).order("created_at",{ascending:false});
 $("timelineResults").innerHTML=(r.data||[]).map(x=>`<div class="timeline"><div class="time">${date(x.created_at)}</div><div><b>${esc(x.event_type)}</b><p>${esc(x.description||"")}</p><small>${esc(x.old_status||"")} → ${esc(x.new_status||"")}</small></div></div>`).join("")||emptyState("No timeline events.");
}

function renderImport(page){
 const type=page.startsWith("order")?"ORDER":page.startsWith("purchase")?"PURCHASE":page.startsWith("sales")?"SALES":null;
 $("content").innerHTML= type ? `<div class="panel import-panel"><h3>${type} Report Import</h3><p>Upload Excel/CSV, validate columns, preview rows, then import into Supabase.</p><div class="dropzone"><input id="fileInput" type="file" accept=".csv,.xlsx,.xls"><div>Choose CSV / Excel file</div></div><div id="importPreview"></div><button class="primary-btn" onclick="startImport('${type}')">Validate & Import</button></div>` : `<div class="panel"><h3>Import History</h3><div id="importHistory">${emptyState("No import history available.")}</div></div>`;
 if(!type) loadImportHistory();
}
async function startImport(type){
 const file=$("fileInput").files[0]; if(!file){alert("Select a file.");return;}
 if(!state.supabase){alert("Connect Supabase first.");return;}
 alert("File selected. The production importer should map the file columns to the configured Supabase fields before inserting data.");
}
async function loadImportHistory(){
 if(!state.supabase)return;
 const r=await state.supabase.from("import_batches").select("*").order("created_at",{ascending:false}).limit(100);
 $("importHistory").innerHTML=table(["Date","Type","File","Rows","Success","Failed","Status"],(r.data||[]).map(x=>[date(x.created_at),x.import_type,x.file_name,x.total_rows,x.successful_rows,x.failed_rows,x.status]));
}

function renderGate(page){
 const title={bhilarwadi:"Bhilarwadi In / Out",gate:"Vehicle In / Out","bulk-gate":"Bulk Vehicle In / Out","gate-pass":"Gate Pass",register:"In-Out Register"}[page];
 $("content").innerHTML=`<div class="panel"><div class="panel-head"><h3>${title}</h3>${page==="register"?`<button class="secondary-btn" onclick="loadGateRegister()">Refresh</button>`:""}</div>
 ${page==="register"?`<div id="gateRegister">${emptyState("No live gate movements.")}</div>`:`<form id="gateForm" class="form-grid">
 <div><label>VIN</label><input name="vin" required></div><div><label>MOVEMENT</label><select name="movement_type"><option>IN</option><option>OUT</option></select></div>
 <div><label>REASON</label><select name="movement_reason"><option>PURCHASE</option><option>DELIVERY</option><option>TRANSFER</option><option>TEST_DRIVE</option><option>OTHER</option></select></div>
 <div><label>GATE NAME</label><input name="gate_name"></div><div><label>DRIVER NAME</label><input name="driver_name"></div><div><label>DRIVER MOBILE</label><input name="driver_mobile"></div>
 <div class="full"><label>REMARKS</label><textarea name="remarks"></textarea></div><div class="full form-actions"><button class="primary-btn">Save Gate Movement</button></div></form>`}</div>`;
 if(page==="register")loadGateRegister(); else $("gateForm").addEventListener("submit",saveGate);
}
async function saveGate(e){
 e.preventDefault(); if(!state.supabase){alert("Connect Supabase first.");return;}
 const f=Object.fromEntries(new FormData(e.target).entries());
 const v=await state.supabase.from("vehicles").select("id").eq("vin",f.vin).maybeSingle();
 if(!v.data){alert("VIN not found.");return;}
 f.vehicle_id=v.data.id;
 delete f.vin;
 const {error}=await state.supabase.from("gate_movements").insert(f);
 if(error)alert(error.message);else{e.target.reset();alert("Gate movement saved.");}
}
async function loadGateRegister(){
 if(!state.supabase)return;
 const r=await state.supabase.from("gate_movement_report").select("*").order("movement_time",{ascending:false}).limit(200);
 $("gateRegister").innerHTML=table(["Date","Type","Reason","VIN","From","To","Gate","Pass"],(r.data||[]).map(x=>[date(x.movement_time),x.movement_type,x.movement_reason,x.vin,x.from_location||"-",x.to_location||"-",x.gate_name||"-",x.gate_pass_no||"-"]));
}

function renderDelivery(page){
 $("content").innerHTML=`<div class="panel"><div class="panel-head"><h3>${page==="delivery-entry"?"Delivery Entry":page==="delivered"?"Delivered Vehicles":"Delivery History"}</h3></div>
 ${page==="delivery-entry"?`<form id="deliveryForm" class="form-grid">
 <div><label>VIN</label><input name="vin" required></div><div><label>DELIVERY NO</label><input name="delivery_no" required></div>
 <div><label>CUSTOMER NAME</label><input name="customer_name"></div><div><label>CUSTOMER MOBILE</label><input name="customer_mobile"></div>
 <div><label>FINANCE COMPANY</label><input name="finance_company"></div><div><label>DELIVERY DATE</label><input name="delivery_date" type="date"></div>
 <div class="full"><label>REMARKS</label><textarea name="remarks"></textarea></div><div class="full form-actions"><button class="primary-btn">Complete Delivery</button></div></form>`:`<div id="deliveryResults">${emptyState("No live delivery data available.")}</div>`}</div>`;
 if(page!=="delivery-entry")loadDeliveries();
 else $("deliveryForm").addEventListener("submit",saveDelivery);
}
async function saveDelivery(e){
 e.preventDefault(); if(!state.supabase){alert("Connect Supabase first.");return;}
 const f=Object.fromEntries(new FormData(e.target).entries());
 const v=await state.supabase.from("vehicles").select("id").eq("vin",f.vin).maybeSingle();
 if(!v.data){alert("VIN not found.");return;}
 const vehicleId=v.data.id; delete f.vin; f.vehicle_id=vehicleId;
 const {error}=await state.supabase.from("deliveries").insert(f);
 if(error){alert(error.message);return;}
 const up=await state.supabase.from("vehicles").update({status:"DELIVERED",delivery_date:f.delivery_date||new Date().toISOString().slice(0,10)}).eq("id",vehicleId);
 if(up.error)alert(up.error.message);else{e.target.reset();alert("Delivery completed.");}
}
async function loadDeliveries(){
 if(!state.supabase)return;
 const r=await state.supabase.from("delivery_report").select("*").order("delivery_date",{ascending:false}).limit(200);
 $("deliveryResults").innerHTML=table(["Delivery No","Date","VIN","Model","Customer","Finance","Location"],(r.data||[]).map(x=>[x.delivery_no,date(x.delivery_date),x.vin,x.model,x.customer_name,x.finance_company||"-",x.location_name||"-"]));
}

function renderReport(page){
 if(page==="dashboard-report") return renderDashboardReport();
 const map={
 "location-report":["Location Stock","location_stock_report",["Location","Vehicles","Stock Value"],r=>[r.location_name,r.vehicle_count,money(r.stock_value)]],
 "model-report":["Model Stock","model_stock_report",["Model","Vehicles","Stock Value"],r=>[r.model,r.vehicle_count,money(r.stock_value)]],
 "finance-report":["Finance-wise Stock","finance_stock_report",["Finance","Vehicles","Stock Value"],r=>[r.finance_company,r.vehicle_count,money(r.stock_value)]],
 "aging-report":["Aging Report","aging_report",["VIN","Model","Status","Purchase Date","Aging Days","Bucket"],r=>[r.vin,r.model,r.status,date(r.purchase_date),r.aging_days,r.aging_bucket]],
 "delivery-report":["Delivery Report","delivery_report",["Delivery No","Date","VIN","Model","Customer","Finance"],r=>[r.delivery_no,date(r.delivery_date),r.vin,r.model,r.customer_name,r.finance_company||"-"]],
 "pending-report":["Pending Order Report","pending_order_report",["Order No","Date","Model","Variant","Qty","Expected","Status"],r=>[r.order_no,date(r.order_date),r.model,r.variant,r.quantity,date(r.expected_date),r.status]],
 "transit-report":["In Transit Report","in_transit_report",["VIN","Model","Variant","Status","Value"],r=>[r.vin,r.model,r.variant,r.status,money(r.stock_value)]],
 "gate-report":["Gate Movement Report","gate_movement_report",["Date","Type","VIN","From","To","Gate"],r=>[date(r.movement_time),r.movement_type,r.vin,r.from_location||"-",r.to_location||"-",r.gate_name||"-"]],
 "dealer-report":["Dealer Code-wise Stock","dealer_code_stock_report",["Dealer Code","Vehicles","Stock Value"],r=>[r.dealer_code,r.vehicle_count,money(r.stock_value)]]
 };
 const m=map[page]; $("content").innerHTML=`<div class="panel"><div class="panel-head"><h3>${m?m[0]:"Report"}</h3><button class="secondary-btn" onclick="loadReport('${page}')">↻ Refresh</button></div><div id="reportTable">${emptyState("Loading live report...")}</div></div>`;
 loadReport(page);
}
async function loadReport(page){
 const map={
 "location-report":["location_stock_report",["Location","Vehicles","Stock Value"],r=>[r.location_name,r.vehicle_count,money(r.stock_value)]],
 "model-report":["model_stock_report",["Model","Vehicles","Stock Value"],r=>[r.model,r.vehicle_count,money(r.stock_value)]],
 "finance-report":["finance_stock_report",["Finance","Vehicles","Stock Value"],r=>[r.finance_company,r.vehicle_count,money(r.stock_value)]],
 "aging-report":["aging_report",["VIN","Model","Status","Purchase Date","Aging Days","Bucket"],r=>[r.vin,r.model,r.status,date(r.purchase_date),r.aging_days,r.aging_bucket]],
 "delivery-report":["delivery_report",["Delivery No","Date","VIN","Model","Customer","Finance"],r=>[r.delivery_no,date(r.delivery_date),r.vin,r.model,r.customer_name,r.finance_company||"-"]],
 "pending-report":["pending_order_report",["Order No","Date","Model","Variant","Qty","Expected","Status"],r=>[r.order_no,date(r.order_date),r.model,r.variant,r.quantity,date(r.expected_date),r.status]],
 "transit-report":["in_transit_report",["VIN","Model","Variant","Status","Value"],r=>[r.vin,r.model,r.variant,r.status,money(r.stock_value)]],
 "gate-report":["gate_movement_report",["Date","Type","VIN","From","To","Gate"],r=>[date(r.movement_time),r.movement_type,r.vin,r.from_location||"-",r.to_location||"-",r.gate_name||"-"]],
 "dealer-report":["dealer_code_stock_report",["Dealer Code","Vehicles","Stock Value"],r=>[r.dealer_code,r.vehicle_count,money(r.stock_value)]]
 };
 const m=map[page]; if(!m)return;
 if(!state.supabase){$("reportTable").innerHTML=emptyState("Connect Supabase to load live report.");return;}
 const r=await state.supabase.from(m[0]).select("*").limit(1000);
 $("reportTable").innerHTML=r.error?emptyState(r.error.message):table(m[1],(r.data||[]).map(m[2]));
}

function renderDashboardReport(){
  $("content").innerHTML=`<div class="panel">
    <div class="panel-head"><div><h3>Dashboard Report</h3><small>All dashboard stock data in one report</small></div><button class="primary-btn" id="exportDashboardExcel">Export to Excel</button></div>
    <div class="report-filters dashboard-report-filters">
      <select id="drLocation"><option value="">All Locations</option></select>
      <select id="drStatus"><option value="">All Status</option></select>
      <input id="drSearch" placeholder="Search VIN / chassis / model / color">
      <button class="secondary-btn" id="drApply">Apply Filter</button><button class="secondary-btn" id="drClear">Clear</button>
    </div>
    <div id="dashboardReportSummary" class="report-summary"></div>
    <div id="dashboardReportTable">${emptyState("Loading dashboard report...")}</div>
  </div>`;
  loadDashboardReport();
  $("drApply").onclick=loadDashboardReport;
  $("drClear").onclick=()=>{ $("drLocation").value=""; $("drStatus").value=""; $("drSearch").value=""; loadDashboardReport(); };
  $("exportDashboardExcel").onclick=exportDashboardExcel;
}

let dashboardReportRows=[];
async function loadDashboardReport(){
  if(!state.supabase){$("dashboardReportTable").innerHTML=emptyState("Connect Supabase to load report.");return;}
  const q=state.supabase.from("vehicles").select("vin,chassis_no,model,variant,color,status,location_id,finance_company,dealer_code,stock_value,purchase_date").order("created_at",{ascending:false}).limit(10000);
  const r=await q;
  if(r.error){$("dashboardReportTable").innerHTML=emptyState(r.error.message);return;}
  let rows=r.data||[];
  const search=($('drSearch').value||'').trim().toLowerCase();
  const status=$('drStatus').value; const location=$('drLocation').value;
  if(status) rows=rows.filter(x=>(x.status||"")===status);
  if(location) rows=rows.filter(x=>String(x.location_id||"")===location);
  if(search) rows=rows.filter(x=>[x.vin,x.chassis_no,x.model,x.variant,x.color].some(v=>String(v||"").toLowerCase().includes(search)));
  dashboardReportRows=rows;
  const total=rows.length, value=rows.reduce((a,x)=>a+Number(x.stock_value||0),0);
  $('dashboardReportSummary').innerHTML=`<div><b>Vehicles</b><strong>${total.toLocaleString("en-IN")}</strong></div><div><b>Stock Value</b><strong>${money(value)}</strong></div>`;
  $('dashboardReportTable').innerHTML=table(["VIN","Chassis","Model","Variant","Color","Status","Finance","Dealer Code","Stock Value"],rows.map(x=>[x.vin,x.chassis_no,x.model,x.variant,x.color,`<span class="badge">${esc(x.status||"-")}</span>`,x.finance_company||"-",x.dealer_code||"-",money(x.stock_value)]));
  const locs=await state.supabase.from("locations").select("id,location_name,location_code,active").order("location_name");
  if(locs.data) $('drLocation').innerHTML='<option value="">All Locations</option>'+locs.data.filter(x=>x.active!==false).map(x=>`<option value="${x.id}">${esc(x.location_name)} (${esc(x.location_code||"")})</option>`).join('');
  const statuses=[...new Set((r.data||[]).map(x=>x.status).filter(Boolean))].sort();
  $('drStatus').innerHTML='<option value="">All Status</option>'+statuses.map(x=>`<option>${esc(x)}</option>`).join('');
}

function exportDashboardExcel(){
  if(!dashboardReportRows.length){alert("No data to export.");return;}
  const rows=dashboardReportRows.map(x=>({VIN:x.vin||"",Chassis:x.chassis_no||"",Model:x.model||"",Variant:x.variant||"",Color:x.color||"",Status:x.status||"",Finance:x.finance_company||"",Dealer_Code:x.dealer_code||"",Stock_Value:Number(x.stock_value||0),Purchase_Date:x.purchase_date||""}));
  if(window.XLSX){
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Dashboard Report"); XLSX.writeFile(wb,`Kothari_Hyundai_Dashboard_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  } else {
    const headers=Object.keys(rows[0]); const csv=[headers.join(","),...rows.map(r=>headers.map(h=>`"${String(r[h]).replaceAll('"','""')}"`).join(","))].join("\n"); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=`Kothari_Hyundai_Dashboard_Report_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }
}

async function renderAdmin(page){
 const titles={
 users:"Create Users & Roles",permissions:"Permissions","assign-roles":"Assign Roles","user-status":"User Status",audit:"Audit Logs",
 company:"Company",locations:"Locations","import-config":"Import Configuration","system-settings":"System Settings"
 };
 const t=titles[page]||"Administration";

 if(page==="users"){
   if(state.role!=="Admin"){
     $("content").innerHTML=`<div class="panel"><div class="notice"><b>Access denied</b><p>Only Admin can create users.</p></div></div>`;
     return;
   }

   $("content").innerHTML=`<div class="panel">
     <div class="panel-head"><h3>Create User</h3></div>
     <form id="createUserForm" class="form-grid">
       <div><label>USERNAME</label><input name="username" required placeholder="accounts01"></div>
       <div><label>FULL NAME</label><input name="full_name" required placeholder="Accounts User"></div>
       <div><label>PASSWORD</label><input name="password" required type="password" minlength="6" maxlength="12" placeholder="6 to 12 characters"></div>
       <div><label>ROLE</label><select name="role_id" id="newUserRole" required><option value="">Loading roles...</option></select></div>
       <div><label>LOCATION</label><select name="location_id" id="newUserLocation"><option value="">All Locations</option></select></div>
       <div><label>STATUS</label><select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></div>
       <div class="full form-actions"><button class="primary-btn" type="submit">Create User</button></div>
     </form>
     <div id="createUserMessage" class="message"></div>
   </div>
   <div class="panel"><div class="panel-head"><h3>Users</h3><button class="secondary-btn" id="refreshUsersBtn">↻ Refresh</button></div>
     <div id="usersTable">${emptyState("Loading users...")}</div>
   </div></div>`;

   await loadUserCreateOptions();
   $("createUserForm").addEventListener("submit",createUser);
   $("refreshUsersBtn").addEventListener("click",loadUsers);
   await loadUsers();
   return;
 }

 if(!["Admin"].includes(state.role) && ["permissions","assign-roles","user-status","audit","company","locations","import-config","system-settings"].includes(page)){
   $("content").innerHTML=`<div class="panel"><div class="notice"><b>Access denied</b><p>Only Admin can access this section.</p></div></div>`;
   return;
 }

 $("content").innerHTML=`<div class="panel"><div class="panel-head"><h3>${t}</h3></div>
 <div class="notice"><b>Kothari Hyundai</b><p>This administration module is connected to Supabase. Configure the relevant records here.</p></div>
 <div class="empty-state"><div class="empty-icon">⚙</div><h4>${t}</h4><p>No records to display.</p></div></div>`;
}

async function loadUserCreateOptions(){
  const roles=await state.supabase.from("roles").select("id,name").order("name");
  const roleEl=$("newUserRole");
  if(roles.error){
    roleEl.innerHTML=`<option value="">Unable to load roles</option>`;
  }else{
    roleEl.innerHTML=`<option value="">Select role</option>`+
      (roles.data||[]).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
  }

  const loc=await state.supabase.from("locations").select("id,location_name,location_code,active").order("location_name");
  const locEl=$("newUserLocation");
  if(!loc.error && loc.data){
    locEl.innerHTML=`<option value="">All Locations</option>`+
      loc.data.filter(x=>x.active!==false).map(x=>`<option value="${x.id}">${esc(x.location_name)}${x.location_code?` (${esc(x.location_code)})`:""}</option>`).join("");
  }
}

async function createUser(e){
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target).entries());
  const msg=$("createUserMessage");
  msg.className="message";
  msg.textContent="Creating user...";

  if(String(f.password).length<6 || String(f.password).length>12){
    msg.textContent="Password must be 6 to 12 characters.";
    msg.className="message error";
    return;
  }

  const session=await state.supabase.auth.getSession();
  const token=session.data.session?.access_token;
  if(!token){
    msg.textContent="Admin session expired. Please login again.";
    msg.className="message error";
    return;
  }

  const response=await fetch(`${SUPABASE_CONFIG.url}/functions/v1/create-user`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${token}`
    },
    body:JSON.stringify({
      username:normalizeUsername(f.username),
      full_name:f.full_name.trim(),
      password:f.password,
      role_id:f.role_id,
      location_id:f.location_id||null,
      active:f.active==="true"
    })
  });

  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    msg.textContent=result.error||"Unable to create user.";
    msg.className="message error";
    return;
  }

  msg.textContent=`User ${result.user?.username||f.username} created successfully.`;
  msg.className="message success";
  e.target.reset();
  await loadUsers();
}

async function loadUsers(){
  if(!state.supabase || $("usersTable")===null) return;

  const [users,locations]=await Promise.all([
    state.supabase.from("user_profiles")
      .select("id,username,full_name,active,created_at,roles(name),location_id")
      .order("created_at",{ascending:false}),
    state.supabase.from("locations")
      .select("id,location_name,location_code")
      .order("location_name")
  ]);

  if(users.error){
    $("usersTable").innerHTML=emptyState(friendlyDbError(users.error));
    return;
  }

  const locMap=Object.fromEntries(
    (locations.data||[]).map(x=>[
      x.id,
      `${x.location_name}${x.location_code?` (${x.location_code})`:""}`
    ])
  );

  $("usersTable").innerHTML=table(
    ["Username","Name","Role","Location","Status","Created"],
    (users.data||[]).map(x=>[
      x.username,
      x.full_name||"-",
      x.roles?.name||"-",
      x.location_id ? (locMap[x.location_id]||x.location_id) : "All Locations",
      x.active?"Active":"Inactive",
      date(x.created_at)
    ])
  );
}

function table(headers, rows){
 if(!rows.length)return emptyState("No records found.");
 return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function escHtml(v){return typeof v==="string" && v.includes("<") ? v : esc(v);}
function emptyState(text){return `<div class="empty-state"><div class="empty-icon">⌁</div><p>${esc(text)}</p></div>`;}
function money(v){return "₹ "+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});}
function date(v){return v?new Date(v).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"-";}

document.addEventListener("DOMContentLoaded",init);

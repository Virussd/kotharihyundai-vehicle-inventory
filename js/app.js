const MENU = [
  {section:"MAIN", items:[["dashboard","Dashboard","▦"]]},
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
    ["location-report","Location Stock","▥"],["model-report","Model Stock","▥"],
    ["finance-report","Finance-wise Stock","₹"],["aging-report","Aging Report","◴"],
    ["delivery-report","Delivery Report","✓"],["pending-report","Pending Order Report","!"],
    ["transit-report","In Transit Report","→"],["gate-report","Gate Movement Report","⇄"],
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

const state = {page:"dashboard", user:null, profile:null, role:null, supabase:null, connected:false};

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
  $("logoutBtn").addEventListener("click", logout);
  $("refreshBtn").addEventListener("click", () => loadPage(state.page));
  $("mobileMenu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
}

function setConnection(ok) {
  $("connectionDot").className = "dot " + (ok ? "online" : "offline");
  $("connectionText").textContent = ok ? "Supabase connected" : "Supabase not configured";
}

function allowedPages(){
  if(state.role === "admin") return null;

  if(state.role === "accounts"){
    return new Set([
      "dashboard","vehicles","search","status","timeline",
      "order-import","purchase-import","sales-import","import-history",
      "bhilarwadi","gate","bulk-gate","gate-pass","register",
      "delivery-entry","delivered","delivery-history",
      "location-report","model-report","finance-report","aging-report",
      "delivery-report","pending-report","transit-report","gate-report","dealer-report"
    ]);
  }

  if(state.role === "gate operator"){
    return new Set(["gate","gate-pass","register"]);
  }

  if(state.role === "viewer"){
    return new Set([
      "dashboard","location-report","model-report","finance-report","aging-report",
      "delivery-report","pending-report","transit-report","gate-report","dealer-report"
    ]);
  }

  return new Set(["dashboard"]);
}

function renderNav() {
  const allowed = allowedPages();

  $("nav").innerHTML = MENU.map(group => {
    const items = allowed === null
      ? group.items
      : group.items.filter(([id]) => allowed.has(id));

    if(!items.length) return "";

    return `<div class="nav-group">
      <div class="nav-label">${group.section}</div>
      ${items.map(([id,label,icon]) =>
        `<button class="nav-item" data-page="${id}">
          <span>${icon}</span>${label}
        </button>`).join("")}
    </div>`;
  }).join("");

  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => {
    state.page=b.dataset.page;
    document.querySelector(".sidebar").classList.remove("open");
    loadPage(state.page);
  }));
}

async function login(e) {
  e.preventDefault();
  const username = $("username").value.trim().toLowerCase();
  const password = $("password").value;

  if (!username || !password) {
    $("loginMessage").textContent = "Enter username and password.";
    $("loginMessage").className = "message error";
    return;
  }

  if (!state.supabase) {
    $("loginMessage").textContent = "Supabase is not configured.";
    $("loginMessage").className = "message error";
    return;
  }

  $("loginMessage").textContent = "Signing in...";
  $("loginMessage").className = "message";

  const {data,error} = await state.supabase.auth.signInWithPassword({
    email: usernameEmail(username),
    password
  });

  if(error){
    $("loginMessage").textContent = "Invalid username or password.";
    $("loginMessage").className = "message error";
    return;
  }

  await showApp(data.user);
}
async function logout(){ if(state.supabase) await state.supabase.auth.signOut(); showLogin(); }
function showLogin(){ $("loginView").classList.remove("hidden"); $("appView").classList.add("hidden"); }
async function showApp(user){
  state.user=user;
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  if(state.supabase){
    const {data,error} = await state.supabase
      .from("user_profiles")
      .select("id,username,full_name,role_id,active,roles(name)")
      .eq("id",user.id)
      .maybeSingle();

    if(error || !data || data.active === false){
      await state.supabase.auth.signOut();
      $("loginMessage").textContent = "User profile is inactive or not configured.";
      $("loginMessage").className = "message error";
      showLogin();
      return;
    }

    state.profile=data;
    state.role=String(data.roles?.name || "").toLowerCase();
    $("userName").textContent=data.full_name || data.username || "User";
  }

  renderNav();
  loadPage("dashboard");
}
function navActive(){document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===state.page));}

async function loadPage(page) {
  const allowed = allowedPages();
  if(allowed !== null && !allowed.has(page)){
    page = state.role === "gate operator" ? "gate" : "dashboard";
  }
  state.page=page;
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
  <div class="cards">
    ${["Total Stock","Available Stock","In Transit","Pending Order","Bill / Not Delivered","Delivered"].map((x,i)=>`
      <div class="stat-card"><div class="stat-title">${x}</div><div class="stat-value" id="stat${i}">0</div><div class="stat-note">Live Supabase data</div></div>`).join("")}
  </div>
  <div class="grid-2">
    <div class="panel"><div class="panel-head"><h3>Location Stock</h3><button class="secondary-btn" onclick="loadPage('location-report')">View Report</button></div><div id="locationTable" class="table-wrap">${emptyState("No live location data available.")}</div></div>
    <div class="panel"><div class="panel-head"><h3>Recent Gate Movement</h3><button class="secondary-btn" onclick="loadPage('gate-report')">View Report</button></div><div id="gateTable" class="table-wrap">${emptyState("No gate movements available.")}</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Quick Actions</h3></div><div class="quick-actions">
    <button onclick="loadPage('vehicles')">+ Vehicle Stock</button><button onclick="loadPage('order-import')">Import Order</button>
    <button onclick="loadPage('gate')">Gate In / Out</button><button onclick="loadPage('delivery-entry')">Delivery Entry</button>
    <button onclick="loadPage('search')">Search VIN</button>
  </div></div>`;
  if(!state.supabase) return;
  loadDashboardData();
}

async function loadDashboardData(){
  try{
    const {data,error}=await state.supabase.from("dashboard_stock_summary").select("*").single();
    if(error) throw error;
    const vals=[data.total_stock,data.available_stock,data.in_transit,data.pending_order,data.bill_not_delivered,data.delivered];
    vals.forEach((v,i)=>$("stat"+i).textContent=Number(v||0).toLocaleString("en-IN"));
    const loc=await state.supabase.from("location_stock_report").select("*").order("vehicle_count",{ascending:false});
    $("locationTable").innerHTML=table(["Location","Vehicles","Stock Value"],(loc.data||[]).map(r=>[r.location_name,r.vehicle_count, money(r.stock_value)]));
    const gate=await state.supabase.from("gate_movement_report").select("*").order("movement_time",{ascending:false}).limit(8);
    $("gateTable").innerHTML=table(["Date","Type","VIN","Location"],(gate.data||[]).map(r=>[date(r.movement_time),r.movement_type,r.vin,r.to_location||r.from_location||"-"]));
  }catch(e){console.error(e);}
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

let importRows = [];

function renderImport(page){
 const type=page.startsWith("order")?"ORDER":page.startsWith("purchase")?"PURCHASE":page.startsWith("sales")?"SALES":null;
 const help = type === "ORDER"
   ? "Expected file: SaleDealerOrderStatus. Imports Order Date, Order No, Model, Variant, Color, Order Amount, VIN, Order Status and customer fields into Pending Order data."
   : type === "PURCHASE"
   ? "Expected file: VehicleDeliveryStatusReport. Imports VIN, chassis/engine, model, variant, color, financier, invoice values and purchase date into Vehicle Stock."
   : "";
 $("content").innerHTML= type ? `<div class="panel import-panel"><h3>${type} Report Import</h3><p>${help}</p><div class="dropzone"><input id="fileInput" type="file" accept=".csv,.xlsx,.xls"><div>Choose CSV / Excel file</div></div><div id="importPreview">${emptyState("Choose a file to preview rows.")}</div><button class="primary-btn" onclick="startImport('${type}')">Validate & Import</button></div>` : `<div class="panel"><h3>Import History</h3><div id="importHistory">${emptyState("No import history available.")}</div></div>`;
 if(!type) loadImportHistory();
 $("fileInput")?.addEventListener("change", previewImportFile);
}

async function previewImportFile(){
 const file=$("fileInput").files[0];
 if(!file)return;
 try{
   importRows=await readSpreadsheet(file);
   const type=state.page.startsWith("order")?"ORDER":state.page.startsWith("purchase")?"PURCHASE":"SALES";
   const mapped=mapImportRows(type,importRows);
   const sample=mapped.slice(0,10);
   $("importPreview").innerHTML=`<div class="notice"><b>${file.name}</b><p>${mapped.length.toLocaleString("en-IN")} data rows detected. Previewing first ${sample.length}.</p></div>`+
     table(Object.keys(sample[0]||{}),sample.map(r=>Object.values(r)));
 }catch(e){
   importRows=[];
   $("importPreview").innerHTML=emptyState("Unable to read file: "+e.message);
 }
}

async function readSpreadsheet(file){
 if(typeof XLSX === "undefined") throw new Error("Excel importer library did not load. Refresh the page and try again.");
 const buf=await file.arrayBuffer();
 const wb=XLSX.read(buf,{type:"array",cellDates:false});
 const ws=wb.Sheets[wb.SheetNames[0]];
 return XLSX.utils.sheet_to_json(ws,{defval:"",raw:false,blankrows:false});
}

function cleanText(v){return String(v??"").trim();}
function numberValue(v){
 const n=Number(String(v??"").replace(/,/g,""));
 return Number.isFinite(n)?n:0;
}
function dateValue(v){
 const s=cleanText(v); if(!s)return null;
 const parts=s.split("/");
 if(parts.length===3){
   const [d,m,y]=parts.map(x=>Number(x));
   if(y>1900)return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
 }
 const dt=new Date(s); return Number.isNaN(dt.getTime())?null:dt.toISOString().slice(0,10);
}
function pick(r,...names){for(const n of names){if(r[n]!==undefined&&cleanText(r[n])!=="")return r[n];}return "";}
function normalizeOrderStatus(v){
 const s=cleanText(v).toUpperCase();
 if(s.includes("DELIVER"))return "DELIVERED";
 if(s.includes("INVOICE")||s.includes("BILL"))return "BILLED";
 if(s.includes("TRANSIT"))return "IN_TRANSIT";
 if(s.includes("CANCEL"))return "CANCELLED";
 return "PENDING";
}
function mapImportRows(type,rows){
 if(type==="ORDER") return rows.filter(r=>cleanText(pick(r,"Order No","Order No.","Order Number"))).map(r=>({
   order_no:cleanText(pick(r,"Order No","Order No.","Order Number")),
   order_date:dateValue(pick(r,"Order Date")),
   model:cleanText(pick(r,"Model")),
   variant:cleanText(pick(r,"Variant")),
   color:cleanText(pick(r,"Color")),
   quantity:1,
   expected_date:dateValue(pick(r,"Assigned Date","Confirm date","Confirmed Date")),
   status:normalizeOrderStatus(pick(r,"Order Status","Status")),
   dealer_code:cleanText(pick(r,"Dealer","Main Dealer")),
   remarks:`PIS: ${cleanText(pick(r,"PIS No"))} | VIN: ${cleanText(pick(r,"VIN No.","VIN No"))} | Customer: ${cleanText(pick(r,"Customer Name"))}`
 }));
 if(type==="PURCHASE") return rows.filter(r=>cleanText(pick(r,"Vin No.","VIN No","VIN"))).map(r=>({
   vin:cleanText(pick(r,"Vin No.","VIN No","VIN")),
   chassis_no:cleanText(pick(r,"Vin No.","VIN No","VIN")),
   engine_no:cleanText(pick(r,"Engine No ","Engine No","Engine Number")),
   model:cleanText(pick(r,"Model")),
   variant:cleanText(pick(r,"Variant")),
   color:cleanText(pick(r,"Color")),
   fuel_type:cleanText(pick(r,"Emission Type")),
   transmission:"",
   order_no:cleanText(pick(r,"Order No","Order No.")),
   dealer_code:cleanText(pick(r,"Dealer","Main Dealer")),
   finance_company:cleanText(pick(r,"Financier Name")),
   status:cleanText(pick(r,"GRN No"))?"AVAILABLE":"IN_TRANSIT",
   stock_value:numberValue(pick(r,"HMI Invoice Amount","Total Invoice value","Basic Price")),
   purchase_date:dateValue(pick(r,"HMI Invoice Date","Order Date")),
   remarks:`HMI Invoice: ${cleanText(pick(r,"HMI Invoice No"))} | GRN: ${cleanText(pick(r,"GRN No"))} | Transporter: ${cleanText(pick(r,"Transporter Name"))}`
 }));
 return rows;
}

async function startImport(type){
 const file=$("fileInput").files[0]; if(!file){alert("Select a file.");return;}
 if(!state.supabase){alert("Connect Supabase first.");return;}
 try{
   const rows=importRows.length?importRows:await readSpreadsheet(file);
   const mapped=mapImportRows(type,rows);
   if(!mapped.length){alert("No valid rows found. Check the report columns.");return;}
   let success=0, failed=0, errors=[];
   if(type==="ORDER"){
     for(const row of mapped){
       const {error}=await state.supabase.from("vehicle_orders").insert(row);
       if(error){failed++;if(errors.length<10)errors.push(error.message);}else success++;
     }
   }else if(type==="PURCHASE"){
     for(const row of mapped){
       const {error}=await state.supabase.from("vehicles").upsert(row,{onConflict:"vin"});
       if(error){failed++;if(errors.length<10)errors.push(error.message);}else success++;
     }
   }else{
     alert("Sales import is not configured yet. Use Order or Purchase Import.");return;
   }
   const batch={import_type:type,file_name:file.name,total_rows:mapped.length,successful_rows:success,failed_rows:failed,status:failed?"COMPLETED_WITH_ERRORS":"COMPLETED",error_details:errors.join(" | ")||null,created_by:state.user?.id||null};
   await state.supabase.from("import_batches").insert(batch);
   $("importPreview").innerHTML=`<div class="notice"><b>Import completed</b><p>Total: ${mapped.length} | Success: ${success} | Failed: ${failed}</p>${errors.length?`<small>${esc(errors.join(" | "))}</small>`:""}</div>`;
   if(failed===0)alert(`${type} import completed: ${success} rows imported.`);else alert(`${type} import completed with errors. Success: ${success}, Failed: ${failed}`);
   importRows=[];
 }catch(e){alert(e.message);}
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

async function renderAdmin(page){
  const titles={
    users:"Create Users & Roles",
    permissions:"Permissions",
    "assign-roles":"Assign Roles",
    "user-status":"User Status",
    audit:"Audit Logs",
    company:"Company",
    locations:"Locations",
    "import-config":"Import Configuration",
    "system-settings":"System Settings"
  };
  const t=titles[page]||"Administration";

  if(page==="users"){
    if(state.role!=="admin"){
      $("content").innerHTML=emptyState("Admin access required.");
      return;
    }

    $("content").innerHTML=`
      <div class="panel">
        <div class="panel-head"><h3>Create User</h3></div>
        <form id="createUserForm" class="form-grid">
          <div>
            <label>USERNAME</label>
            <input name="username" placeholder="e.g. accounts01"
              pattern="[a-z0-9._-]{3,30}" required>
          </div>
          <div>
            <label>FULL NAME</label>
            <input name="full_name" placeholder="User full name" required>
          </div>
          <div>
            <label>PASSWORD</label>
            <input name="password" type="password" minlength="8"
              placeholder="Minimum 8 characters" required>
          </div>
          <div>
            <label>ROLE</label>
            <select name="role_id" id="createRole" required>
              <option value="">Loading roles...</option>
            </select>
          </div>
          <div>
            <label>LOCATION</label>
            <select name="location_id" id="createLocation">
              <option value="">No location</option>
            </select>
          </div>
          <div>
            <label>STATUS</label>
            <select name="active">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div class="full form-actions">
            <button class="primary-btn" type="submit">Create User</button>
          </div>
        </form>
        <div id="createUserMessage" class="message"></div>
      </div>`;

    await loadUserCreateOptions();
    $("createUserForm").addEventListener("submit", createUser);
    return;
  }

  $("content").innerHTML=`<div class="panel">
    <div class="panel-head"><h3>${t}</h3></div>
    <div class="notice"><b>Admin module</b>
      <p>This section is reserved for the Admin role.</p>
    </div>
  </div>`;
}

async function loadUserCreateOptions(){
  const roleSelect=$("createRole");
  const locationSelect=$("createLocation");

  const roles=await state.supabase.from("roles").select("id,name").order("name");
  if(roles.error){
    roleSelect.innerHTML=`<option value="">${esc(roles.error.message)}</option>`;
  }else{
    roleSelect.innerHTML=(roles.data||[]).map(r =>
      `<option value="${r.id}">${esc(r.name)}</option>`).join("");
  }

  const locations=await state.supabase.from("locations").select("id,name").order("name");
  if(!locations.error && locations.data){
    locationSelect.innerHTML=`<option value="">No location</option>` +
      locations.data.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
  }
}

async function createUser(e){
  e.preventDefault();
  const msg=$("createUserMessage");
  const form=Object.fromEntries(new FormData(e.target).entries());

  msg.textContent="Creating user...";
  msg.className="message";

  const {data,error}=await state.supabase.functions.invoke("create-user",{
    body:{
      username:form.username,
      full_name:form.full_name,
      password:form.password,
      role_id:form.role_id,
      location_id:form.location_id || null,
      active:form.active === "true"
    }
  });

  if(error || data?.error){
    msg.textContent=data?.error || error?.message || "User creation failed.";
    msg.className="message error";
    return;
  }

  msg.textContent=`User ${form.username} created successfully.`;
  msg.className="message success";
  e.target.reset();
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

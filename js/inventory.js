"use strict";
/* =====================================================================
   INVENTORY: dashboard, vehicle stock, timeline, delivery, reports
   ===================================================================== */

const col = (h, k, t = "text") => ({h, k, t});

const REPORTS = {
  "location-report": {title:"Location Stock", source:"location_stock_report", totals:true, sort:["vehicle_count","desc"],
    cols:[col("Location","location_name"), col("Total Vehicles","vehicle_count","num"), col("In Stock","stock_count","num"), col("In Transit","in_transit_count","num"), col("Pending Order","pending_count","num"), col("Stock Value","stock_value","money")]},
  "model-report": {title:"Model Stock", source:"model_stock_report", totals:true, sort:["vehicle_count","desc"],
    cols:[col("Model","model"), col("Total Vehicles","vehicle_count","num"), col("In Stock","stock_count","num"), col("In Transit","in_transit_count","num"), col("Pending Order","pending_count","num"), col("Stock Value","stock_value","money")]},
  "finance-report": {title:"Finance-wise Stock", source:"finance_stock_report", totals:true, sort:["vehicle_count","desc"],
    cols:[col("Financier Name","finance_company"), col("Total Vehicles","vehicle_count","num"), col("In Stock","stock_count","num"), col("In Transit","in_transit_count","num"), col("Pending Order","pending_count","num"), col("Stock Value","stock_value","money")]},
  "dealer-report": {title:"Dealer Code-wise Stock", source:"dealer_code_stock_report", totals:true, sort:["vehicle_count","desc"],
    cols:[col("Dealer","dealer_code"), col("Total Vehicles","vehicle_count","num"), col("In Stock","stock_count","num"), col("In Transit","in_transit_count","num"), col("Pending Order","pending_count","num"), col("Stock Value","stock_value","money")]},
  "aging-report": {title:"Aging Report", source:"aging_report", sort:["aging_days","desc"],
    cols:[col("VIN No.","vin"), col("Order No","order_no"), col("Model","model"), col("Variant","variant"), col("Color","color"), col("Status","status"), col("Purchase / Order Date","purchase_date","date"), col("Aging Days","aging_days","num"), col("Bucket","aging_bucket")]},
  "delivery-report": {title:"Delivery Report", source:"delivery_report", sort:["delivery_date","desc"],
    cols:[col("Delivery No","delivery_no"), col("Date","delivery_date","date"), col("VIN","vin"), col("Model","model"), col("Customer","customer_name"), col("Finance","finance_company")]},
  "pending-report": {title:"Pending Order Report", source:"pending_order_report", sort:["order_date","desc"],
    cols:[col("Order No","order_no"), col("Order Date","order_date","date"), col("PIS No","pis_no"), col("Model","model"), col("Variant","variant"), col("Color","color"), col("Qty","quantity","num"), col("Status","status")]},
  "transit-report": {title:"In Transit Report", source:"in_transit_report",
    cols:[col("Order No","order_no"), col("VIN No.","vin"), col("Engine No","engine_no"), col("Model","model"), col("Variant","variant"), col("Color","color"), col("Dealer","dealer_code"), col("Financier Name","finance_company"), col("HMI Invoice Date","hmi_invoice_date","date"), col("HMI Invoice No","hmi_invoice_no"), col("HMI Invoice Amount","hmi_invoice_amount","money")]},
  "gate-report": {title:"Gate Movement Report", source:"gate_movement_report", sort:["movement_time","desc"],
    cols:[col("Date","movement_time","datetime"), col("Type","movement_type"), col("VIN","vin"), col("From","from_location"), col("To","to_location"), col("Gate","gate_name")]}
};

/* ---------------------------------------------------------------- Dashboard */
const STAT_CARDS = [["Total Order Stock","stat0","all"],["Available Stock","stat1","stock"],["In Transit","stat2","transit"],["Pending Order","stat3","pending"],["Bill / Not Delivered","stat4","bill"],["Delivered","stat5","delivered"]];

function renderDashboard(){
  const link = (page, label) => `<button class="secondary-btn" type="button" onclick="navigate('${page}')" ${can(page) ? "" : "hidden"}>${label}</button>`;
  $("content").innerHTML = `
  <div class="cards dashboard-cards">
    ${STAT_CARDS.map(([x,id,stage]) => `<button type="button" class="stat-card stat-card-button" data-stage="${stage}" title="Click to view vehicles"><div class="stat-title">${x}</div><div class="stat-value" id="${id}">0</div><div class="stat-money" id="${id}v">₹ 0.00</div><div class="stat-note">Click to view list ›</div></button>`).join("")}
  </div>
  <div class="panel"><div class="panel-head"><h3>Model-wise Count & Ageing <small style="font-weight:400;color:#98a2b3">(Total Order Stock − Bill/Not Delivered − Delivered)</small></h3>${link("aging-report","Aging Report")}</div><div id="modelAgeDash" class="table-wrap">${emptyState("Loading...")}</div></div>
  <div class="grid-2">
    <div class="panel"><div class="panel-head"><h3>Available Stock – Finance-wise</h3>${link("finance-report","View Report")}</div><div id="financeDash" class="table-wrap">${emptyState("Loading...")}</div></div>
    <div class="panel"><div class="panel-head"><h3>Available Stock – Dealer Code-wise</h3>${link("dealer-report","View Report")}</div><div id="dealerDash" class="table-wrap">${emptyState("Loading...")}</div></div>
  </div>
  <div class="grid-2">
    <div class="panel"><div class="panel-head"><h3>Status-wise Stock</h3>${link("status","Open")}</div><div id="statusDash" class="status-summary">${emptyState("Loading...")}</div></div>
    <div class="panel"><div class="panel-head"><h3>Recent Vehicle Movements</h3>${link("gate-report","View All")}</div><div id="gateTable" class="table-wrap">${emptyState("Loading...")}</div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Location-wise Stock & Value</h3>${link("location-report","View Report")}</div><div id="locationTable" class="table-wrap">${emptyState("Loading...")}</div></div>
  <div class="panel"><div class="panel-head"><h3>Model-wise Stock & Value</h3>${link("model-report","View Report")}</div><div id="modelDash" class="table-wrap">${emptyState("Loading...")}</div></div>
  <div id="modal"></div>`;
  document.querySelectorAll("[data-stage]").forEach(b => b.addEventListener("click", () => showStageVehicles(b.dataset.stage)));
  if(state.supabase) return loadDashboardData();
}

/* ---- Click a dashboard card -> vehicle list in a window (modal) ---- */
const STAGE_TITLES = {all:"Total Order Stock (All Vehicles)", stock:"Available Stock", transit:"In Transit", pending:"Pending Order", bill:"Bill / Not Delivered", delivered:"Delivered"};
const STAGE_MODAL = {rows:[], title:""};
const STAGE_COLS = [["Order No","order_no"],["VIN No.","vin"],["Model","model"],["Variant","variant"],["Color","color"],["Dealer","dealer_code"],["Financier Name","finance_company"],["Status","status"],["Date","_date"],["Stock Value","_value"]];
function stageCell(v, k){
  if(k === "_date") return fmtD(v.delivery_date ?? v.purchase_date ?? v.hmi_invoice_date ?? v.order_date);
  if(k === "_value") return money(v.stock_value);
  if(k === "status") return statusBadge(v.status);
  if(k === "vin") return raw(`<b class="mono">${esc(v.vin)}</b>`);
  return v[k];
}
async function showStageVehicles(stage){
  const title = STAGE_TITLES[stage] || "Vehicles";
  $("modal").innerHTML = `<div class="modal-bg"><div class="modal" style="width:min(1150px,96vw)" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="panel-head"><h3>${esc(title)} <span id="stageCount" style="color:#98a2b3;font-weight:400"></span></h3>
      <div class="report-tools"><input id="stageFilter" type="search" placeholder="Filter VIN / model / order..." aria-label="Filter"><button class="secondary-btn" type="button" id="stageExport">⤓ Export</button><button class="icon-btn" type="button" id="modalClose" aria-label="Close">×</button></div></div>
    <div class="table-wrap" id="stageTable">${emptyState("Loading...")}</div></div></div>`;
  $("modalClose").addEventListener("click", closeModal);
  $("modal").querySelector(".modal-bg").addEventListener("click", e => { if(e.target.classList.contains("modal-bg")) closeModal(); });
  try {
    const all = await allVehicles();
    await getLocations();
    STAGE_MODAL.title = title;
    STAGE_MODAL.rows = stage === "all" ? all : all.filter(v => vStage(v) === stage);
    const draw = () => {
      const f = $("stageFilter").value.trim().toLowerCase();
      const rows = f ? STAGE_MODAL.rows.filter(v => [v.vin,v.model,v.variant,v.color,v.order_no,v.finance_company,v.dealer_code,v.engine_no].some(x => String(x ?? "").toLowerCase().includes(f))) : STAGE_MODAL.rows;
      $("stageCount").textContent = `(${rows.length.toLocaleString("en-IN")} vehicles)`;
      const shown = rows.slice(0, 500);
      $("stageTable").innerHTML = table(STAGE_COLS.map(c => c[0]), shown.map(v => STAGE_COLS.map(c => stageCell(v, c[1]))),
        rows.length ? ["Total", `${rows.length.toLocaleString("en-IN")} vehicles`, "", "", "", "", "", "", "", raw(`<b>${money(rows.reduce((s,v) => s + vValue(v), 0))}</b>`)] : null)
        + (rows.length > 500 ? `<p style="padding:8px;color:#667085;font-size:12px">Showing first 500 of ${rows.length.toLocaleString("en-IN")}. Use filter or Export for all.</p>` : "");
      STAGE_MODAL.filtered = rows;
    };
    $("stageFilter").addEventListener("input", draw);
    $("stageExport").addEventListener("click", () => {
      const rows = STAGE_MODAL.filtered || STAGE_MODAL.rows;
      if(!rows.length){ toast("Nothing to export.","error"); return; }
      exportSheet("dashboard-" + stage, STAGE_COLS.map(c => c[0]), rows.map(v => STAGE_COLS.map(c => c[1] === "_value" ? vValue(v) : c[1] === "_date" ? (v.delivery_date ?? v.purchase_date ?? v.hmi_invoice_date ?? v.order_date ?? "") : (v[c[1]] ?? ""))));
    });
    draw();
  } catch(err){ $("stageTable").innerHTML = emptyState("Could not load: " + (err.message || err)); }
}

async function getStatusSummary(){
  const rows = await allVehicles();
  const groups = {};
  rows.forEach(v => { const k = v.status || "UNKNOWN"; groups[k] ??= {count:0, value:0}; groups[k].count++; groups[k].value += Number(v.stock_value || 0); });
  return Object.entries(groups).map(([status,v]) => ({status, ...v})).sort((a,b) => b.count - a.count);
}

async function loadDashboardData(){
  const safe = p => Promise.resolve(p).then(data => ({data, error:null}), error => ({error, data:null}));
  const [summary, loc, fin, dealer, model, gate, ageing] = await Promise.all([
    safe(computedRows("dashboard_stock_summary")), safe(computedRows("location_stock_report")), safe(computedRows("finance_stock_report")),
    safe(computedRows("dealer_code_stock_report")), safe(computedRows("model_stock_report")), safe(computedRows("gate_movement_report")), safe(computedRows("model_ageing_report"))
  ]);
  const byCount = r => r.data && r.data.sort((a,b) => b.vehicle_count - a.vehicle_count);
  byCount(ageing);
  if(summary.data?.[0]){
    const d = summary.data[0];
    [d.total_stock, d.available_stock, d.in_transit, d.pending_order, d.bill_not_delivered, d.delivered]
      .forEach((v,i) => { const el = $("stat" + i); if(el) el.textContent = Number(v || 0).toLocaleString("en-IN"); });
    [d.total_value, d.available_value, d.transit_value, d.pending_value, d.bill_value, d.delivered_value]
      .forEach((v,i) => { const el = $("stat" + i + "v"); if(el) el.textContent = money(v); });
  }
  const sum = (rows, k) => (rows || []).reduce((t, r) => t + Number(r[k] || 0), 0);
  const put = (id, res, headers, mapper, footer) => {
    const el = $(id); if(!el) return;
    el.innerHTML = res.error ? emptyState("Could not load: " + (res.error.message || res.error)) : table(headers, (res.data || []).map(mapper), (res.data || []).length ? footer?.(res.data) : null);
  };
  const tot = (label, cells) => [raw(`<b>${label}</b>`), ...cells.map(c => raw(`<b>${c}</b>`))];
  const n = v => Number(v || 0).toLocaleString("en-IN");
  byCount(loc); byCount(fin); byCount(dealer); byCount(model);
  put("locationTable", loc, ["Location","Total","In Stock","In Transit","Pending Order","Stock Value"], r => [r.location_name, r.vehicle_count, r.stock_count, r.in_transit_count, r.pending_count, money(r.stock_value)],
    d => tot("Total", [n(sum(d,"vehicle_count")), n(sum(d,"stock_count")), n(sum(d,"in_transit_count")), n(sum(d,"pending_count")), money(sum(d,"stock_value"))]));
  put("financeDash", fin, ["Financier Name","Total","In Stock","In Transit","Stock Value"], r => [r.finance_company, r.vehicle_count, r.stock_count, r.in_transit_count, money(r.stock_value)],
    d => tot("Total", [n(sum(d,"vehicle_count")), n(sum(d,"stock_count")), n(sum(d,"in_transit_count")), money(sum(d,"stock_value"))]));
  put("dealerDash", dealer, ["Dealer","Total","In Stock","In Transit","Stock Value"], r => [r.dealer_code, r.vehicle_count, r.stock_count, r.in_transit_count, money(r.stock_value)],
    d => tot("Total", [n(sum(d,"vehicle_count")), n(sum(d,"stock_count")), n(sum(d,"in_transit_count")), money(sum(d,"stock_value"))]));
  put("modelDash", model, ["Model","Total","In Stock","In Transit","Pending Order","Stock Value"], r => [r.model, r.vehicle_count, r.stock_count, r.in_transit_count, r.pending_count, money(r.stock_value)],
    d => tot("Total", [n(sum(d,"vehicle_count")), n(sum(d,"stock_count")), n(sum(d,"in_transit_count")), n(sum(d,"pending_count")), money(sum(d,"stock_value"))]));
  put("modelAgeDash", ageing, ["Model","Total Vehicles","0-30 days","31-60 days","61-90 days","90+ days","No Date"], r => [r.model, r.vehicle_count, r.b0, r.b31, r.b61, r.b90, r.bnd],
    d => tot("Total", [n(sum(d,"vehicle_count")), n(sum(d,"b0")), n(sum(d,"b31")), n(sum(d,"b61")), n(sum(d,"b90")), n(sum(d,"bnd"))]));
  put("gateTable", {data:(gate.data || []).slice(0,8), error:gate.error}, ["Date","Type","VIN No.","Location"], r => [fmtDT(r.movement_time), r.movement_type, r.vin, r.to_location || r.from_location]);
  try {
    const groups = await getStatusSummary();
    if($("statusDash")) $("statusDash").innerHTML = groups.map(g =>
      `<div class="status-row"><span><b>${esc(g.status)}</b></span><span>${g.count.toLocaleString("en-IN")} vehicles</span><span>${money(g.value)}</span></div>`).join("")
      + (groups.length ? `<div class="status-row" style="font-weight:800;border-top:2px solid #e4e7ec"><span>Total</span><span>${groups.reduce((t,g) => t + g.count, 0).toLocaleString("en-IN")} vehicles</span><span>${money(groups.reduce((t,g) => t + g.value, 0))}</span></div>` : "")
      || emptyState("No stock data yet. Import the Order / Purchase report to begin.");
  } catch(err){ if($("statusDash")) $("statusDash").innerHTML = emptyState("Could not load: " + err.message); }
}

/* --------------------------------------------------------------- Vehicles */
const VEH = {page:0, size:50, total:0, q:"", status:"", rows:[]};

async function renderVehicles(page){
  VEH.page = 0; VEH.q = ""; VEH.status = "";
  const canAdd = hasPerm("vehicle.update");
  $("content").innerHTML = `
  ${page === "status" ? `<div id="statusCards" class="cards status-cards">${emptyState("Loading status summary...")}</div>` : ""}
  <div class="toolbar">
    <div class="searchbox">
      <input id="vehicleSearch" placeholder="Search VIN / order no / engine / model / color" autocomplete="off" aria-label="Search vehicles">
      <select id="vehicleStatus" aria-label="Filter by status"><option value="">All status</option></select>
      <button type="button" id="vehicleSearchBtn">Search</button>
    </div>
    <div class="toolbar-actions">
      <button class="secondary-btn" type="button" id="vehicleExport">⤓ Export</button>
      ${canAdd ? `<button class="primary-btn" type="button" id="vehicleAdd">+ Add Vehicle</button>` : ""}
    </div>
  </div>
  <div class="panel"><div class="table-wrap" id="vehicleResults">${emptyState(page === "search" ? "Enter a VIN / chassis / model to search." : "Loading vehicles...")}</div><div class="pager" id="vehiclePager"></div></div>
  <div id="modal"></div>`;

  const run = () => { VEH.q = cleanQuery($("vehicleSearch").value); VEH.status = $("vehicleStatus").value; VEH.page = 0; queryVehicles(); };
  $("vehicleSearchBtn").addEventListener("click", run);
  $("vehicleSearch").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); run(); } });
  $("vehicleStatus").addEventListener("change", run);
  $("vehicleExport").addEventListener("click", exportVehicles);
  $("vehicleAdd")?.addEventListener("click", openVehicleForm);

  if(!state.supabase) return;
  getStatusSummary().then(groups => {
    $("vehicleStatus").insertAdjacentHTML("beforeend", groups.map(g => `<option value="${esc(g.status)}">${esc(g.status)} (${g.count})</option>`).join(""));
    const box = $("statusCards");
    if(box) {
      box.innerHTML = groups.map(g => `<button type="button" class="stat-card stat-card-button" data-status="${esc(g.status)}"><div class="stat-title">${esc(g.status)}</div><div class="stat-value">${g.count.toLocaleString("en-IN")}</div><div class="stat-note">${money(g.value)}</div></button>`).join("") || emptyState("No vehicles yet.");
      box.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => { $("vehicleStatus").value = b.dataset.status; run(); }));
    }
  }).catch(err => { if($("statusCards")) $("statusCards").innerHTML = emptyState(err.message); });
  if(page !== "search") queryVehicles();
}

async function queryVehicles(){
  const box = $("vehicleResults"); if(!box) return;
  if(!state.supabase){ box.innerHTML = emptyState("Connect Supabase to load live vehicles."); return; }
  await getLocations();
  const from = VEH.page * VEH.size;
  let query = state.supabase.from("vehicles")
    .select("*", {count:"exact"})
    .order("id",{ascending:false}).range(from, from + VEH.size - 1);
  if(VEH.q) query = query.or(["vin","order_no","engine_no","model","color"].map(c => `${c}.ilike.%${VEH.q}%`).join(","));
  if(VEH.status) query = query.eq("status", VEH.status);
  const {data, error, count} = await query;
  if(error){ box.innerHTML = emptyState(error.message); return; }
  VEH.rows = data || []; VEH.total = count ?? VEH.rows.length;
  box.innerHTML = table(["Order No","VIN No.","Engine No","Model","Variant","Color","Dealer","Financier Name","HMI Invoice Date","Status","Order Status","Stock Value",""],
    VEH.rows.map(v => [v.order_no, raw(`<b class="mono">${esc(v.vin)}</b>`), v.engine_no, v.model, v.variant, v.color, v.dealer_code, v.finance_company, fmtD(v.hmi_invoice_date ?? v.purchase_date), statusBadge(v.status), v.order_status, money(v.stock_value),
      raw(`<button type="button" class="table-icon-btn" data-vid="${esc(v.id)}">Details</button>`)]));
  box.querySelectorAll("[data-vid]").forEach(b => b.addEventListener("click", () => showVehicleDetails(b.dataset.vid)));
  const pages = Math.max(1, Math.ceil(VEH.total / VEH.size));
  const shownFrom = VEH.total ? from + 1 : 0, shownTo = from + VEH.rows.length;
  $("vehiclePager").innerHTML = `<span>Showing ${shownFrom}–${shownTo} of ${VEH.total.toLocaleString("en-IN")}</span>
    <span><button class="secondary-btn" type="button" id="vehPrev" ${VEH.page === 0 ? "disabled" : ""}>‹ Prev</button>
    <span class="pager-page">Page ${VEH.page + 1} / ${pages}</span>
    <button class="secondary-btn" type="button" id="vehNext" ${VEH.page + 1 >= pages ? "disabled" : ""}>Next ›</button></span>`;
  $("vehPrev").addEventListener("click", () => { VEH.page--; queryVehicles(); });
  $("vehNext").addEventListener("click", () => { VEH.page++; queryVehicles(); });
}

const VEHICLE_EXPORT_COLS = [...EXCEL_FIELDS.map(f => f[0]), "chassis_no", "stock_value", "purchase_date", "status"];
function vehicleCellValue(k, v){ const x = v[k]; return isBlank(x) ? "" : (FIELD_TYPE[k] === "money" || FIELD_TYPE[k] === "num") ? Number(x) : x; }
function exportVehicles(){
  if(!VEH.rows.length){ toast("Nothing to export — search or load vehicles first.","error"); return; }
  exportSheet("vehicle-stock", VEHICLE_EXPORT_COLS.map(k => FIELD_HEADING[k]), VEH.rows.map(v => VEHICLE_EXPORT_COLS.map(k => vehicleCellValue(k, v))));
}
function showVehicleDetails(id){
  const v = VEH.rows.find(x => String(x.id) === String(id)); if(!v) return;
  const rows = VEHICLE_EXPORT_COLS.filter(k => !isBlank(v[k])).map(k => [FIELD_HEADING[k], fmtCell(FIELD_TYPE[k], v[k])]);
  $("modal").innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Vehicle details">
    <div class="panel-head"><h3>${esc(v.vin || v.order_no || "Vehicle")}</h3><button class="icon-btn" type="button" id="modalClose" aria-label="Close">×</button></div>
    <div class="table-wrap">${table(["Field","Value"], rows)}</div></div></div>`;
  $("modalClose").addEventListener("click", closeModal);
}

const VEHICLE_FIELDS = [["vin","VIN",true],["chassis_no","Chassis No"],["engine_no","Engine No"],["model","Model"],["variant","Variant"],["color","Color"],
  ["fuel_type","Fuel Type"],["transmission","Transmission"],["order_no","Order No"],["dealer_code","Dealer Code"],["finance_company","Finance Company"],["vehicle_no","Vehicle No"]];

async function openVehicleForm(){
  const locs = (await getLocations()).filter(l => l.active !== false);
  $("modal").innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Add Vehicle">
    <div class="panel-head"><h3>Add Vehicle</h3><button class="icon-btn" type="button" id="modalClose" aria-label="Close">×</button></div>
    <form id="vehicleForm" class="form-grid">
      ${VEHICLE_FIELDS.map(([k,label,req]) => `<div><label for="vf_${k}">${label.toUpperCase()}${req ? " *" : ""}</label><input id="vf_${k}" name="${k}" ${req ? "required" : ""} autocomplete="off"></div>`).join("")}
      <div><label for="vf_location_id">LOCATION</label><select id="vf_location_id" name="location_id"><option value="">— Select —</option>${locs.map(l => `<option value="${esc(l.id)}">${esc(l.location_name)}</option>`).join("")}</select></div>
      <div><label for="vf_stock_value">STOCK VALUE</label><input id="vf_stock_value" name="stock_value" type="number" step="0.01" min="0"></div>
      <div class="full"><label for="vf_remarks">REMARKS</label><textarea id="vf_remarks" name="remarks"></textarea></div>
      <div class="full form-actions"><button type="button" class="secondary-btn" id="modalCancel">Cancel</button><button class="primary-btn" type="submit">Save Vehicle</button></div>
    </form></div></div>`;
  $("modalClose").addEventListener("click", closeModal);
  $("modalCancel").addEventListener("click", closeModal);
  $("vehicleForm").addEventListener("submit", saveVehicle);
  $("vf_vin").focus();
}
async function saveVehicle(e){
  e.preventDefault();
  if(!state.supabase){ toast("Connect Supabase first.","error"); return; }
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
  const obj = {};
  for(const [k,v] of new FormData(e.target).entries()){ const t = String(v).trim(); obj[k] = t === "" ? null : t; }
  obj.vin = (obj.vin || "").toUpperCase().replace(/\s+/g,"");
  obj.stock_value = Number(obj.stock_value || 0);
  const {error} = await state.supabase.from("vehicles").insert(obj);
  btn.disabled = false;
  if(error){ toast(error.code === "23505" ? "This VIN already exists." : error.message, "error"); return; }
  toast("Vehicle saved.","success"); closeModal(); queryVehicles();
}

/* --------------------------------------------------------------- Timeline */
function renderTimeline(){
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>Vehicle Timeline</h3>
    <div class="searchbox"><input id="timelineVin" placeholder="Enter VIN (or last 6 digits)" autocomplete="off" aria-label="VIN"><button type="button" id="timelineBtn">Search</button></div></div>
    <div id="timelineResults">${emptyState("Search a VIN to view its read-only timeline.")}</div></div>`;
  $("timelineBtn").addEventListener("click", loadTimeline);
  $("timelineVin").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); loadTimeline(); } });
}
async function loadTimeline(){
  const vin = cleanQuery($("timelineVin").value).replace(/\s+/g,"").toUpperCase();
  const out = $("timelineResults");
  if(!vin || !state.supabase) return;
  let v = await state.supabase.from("vehicles").select("id,vin").eq("vin", vin).maybeSingle();
  if(!v.data && vin.length >= 6){
    const f = await state.supabase.from("vehicles").select("id,vin").ilike("vin", `%${vin}`).limit(2);
    if(f.data?.length === 1) v = {data:f.data[0]};
    else if(f.data?.length > 1){ out.innerHTML = emptyState("More than one vehicle ends with these digits — enter more of the VIN."); return; }
  }
  if(!v.data){ out.innerHTML = emptyState("Vehicle not found."); return; }
  const r = await state.supabase.from("vehicle_timeline").select("*").eq("vehicle_id", v.data.id).order("created_at",{ascending:false});
  if(r.error){ out.innerHTML = emptyState(r.error.message); return; }
  out.innerHTML = `<p class="mono timeline-vin">${esc(v.data.vin)}</p>` + ((r.data || []).map(x => `<div class="timeline"><div class="time">${fmtDT(x.created_at)}</div><div><b>${esc(x.event_type)}</b><p>${esc(x.description || "")}</p><small>${esc(x.old_status || "")} → ${esc(x.new_status || "")}</small></div></div>`).join("") || emptyState("No timeline events."));
}

/* --------------------------------------------------------------- Delivery */
function renderDelivery(page){
  const titles = {"delivery-entry":"Delivery Entry", delivered:"Delivered Vehicles", "delivery-history":"Delivery History"};
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>${titles[page]}</h3>${page === "delivery-entry" ? "" : `<button class="secondary-btn" type="button" id="deliveryRefresh">↻ Refresh</button>`}</div>
  ${page === "delivery-entry" ? `<form id="deliveryForm" class="form-grid">
    <div><label for="d_vin">VIN *</label><input id="d_vin" name="vin" required autocomplete="off"></div>
    <div><label for="d_no">DELIVERY NO *</label><input id="d_no" name="delivery_no" required></div>
    <div><label for="d_date">DELIVERY DATE</label><input id="d_date" name="delivery_date" type="date" value="${todayLocal()}"></div>
    <div><label for="d_cust">CUSTOMER NAME</label><input id="d_cust" name="customer_name"></div>
    <div><label for="d_mob">CUSTOMER MOBILE</label><input id="d_mob" name="customer_mobile" inputmode="tel"></div>
    <div><label for="d_fin">FINANCE COMPANY</label><input id="d_fin" name="finance_company"></div>
    <div class="full"><label for="d_rem">REMARKS</label><textarea id="d_rem" name="remarks"></textarea></div>
    <div class="full form-actions"><button class="primary-btn" type="submit">Complete Delivery</button></div></form>`
  : `<div id="deliveryResults">${emptyState("Loading...")}</div>`}</div>`;
  if(page === "delivery-entry") $("deliveryForm").addEventListener("submit", saveDelivery);
  else { $("deliveryRefresh").addEventListener("click", () => loadDeliveries(page)); loadDeliveries(page); }
}
async function saveDelivery(e){
  e.preventDefault();
  if(!state.supabase){ toast("Connect Supabase first.","error"); return; }
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    const f = {};
    for(const [k,v] of new FormData(e.target).entries()){ const t = String(v).trim(); f[k] = t === "" ? null : t; }
    const vin = (f.vin || "").toUpperCase().replace(/\s+/g,"");
    const deliveredStatus = window.APP_CONFIG.deliveredStatus;
    const v = await state.supabase.from("vehicles").select("id,status").eq("vin", vin).maybeSingle();
    if(v.error){ toast(v.error.message,"error"); return; }
    if(!v.data){ toast("VIN not found in vehicle stock.","error"); return; }
    if(String(v.data.status || "").toUpperCase() === String(deliveredStatus).toUpperCase() && !confirm("This vehicle is already marked delivered. Save another delivery entry?")) return;
    delete f.vin; f.vehicle_id = v.data.id;
    if(!f.delivery_date) f.delivery_date = todayLocal();
    const ins = await state.supabase.from("deliveries").insert(f);
    if(ins.error){ toast(ins.error.message,"error"); return; }
    const up = await state.supabase.from("vehicles").update({status: deliveredStatus, delivery_date: f.delivery_date}).eq("id", v.data.id);
    if(up.error){ toast("Delivery saved, but vehicle status was not updated: " + up.error.message, "error"); return; }
    e.target.reset(); e.target.delivery_date.value = todayLocal();
    toast("Delivery completed.","success");
  } finally { btn.disabled = false; }
}
async function loadDeliveries(page){
  const box = $("deliveryResults"); if(!box || !state.supabase) return;
  try {
    if(page === "delivered"){
      const rows = (await computedRows("delivery_report")).sort((a,b) => String(b.delivery_date || "").localeCompare(String(a.delivery_date || "")));
      box.innerHTML = table(["VIN No.","Model","Customer Name","Financier Name","Delivered On","Location"],
        rows.slice(0,500).map(x => [raw(`<b class="mono">${esc(x.vin)}</b>`), x.model, x.customer_name, x.finance_company, fmtD(x.delivery_date), x.location_name]));
      return;
    }
    const rows = (await computedRows("delivery_report")).sort((a,b) => String(b.delivery_date || "").localeCompare(String(a.delivery_date || "")));
    box.innerHTML = table(["Delivery No","Date","VIN No.","Model","Customer Name","Financier Name","Location"],
      rows.slice(0,500).map(x => [x.delivery_no, fmtD(x.delivery_date), x.vin, x.model, x.customer_name, x.finance_company, x.location_name]));
  } catch(err){ box.innerHTML = emptyState("Could not load: " + (err.message || err)); }
}

/* ---------------------------------------------------------------- Reports */
const REPORT = {key:"", rows:[]};

function reportRows(def, rows, filter){
  const f = filter.trim().toLowerCase();
  return f ? rows.filter(r => def.cols.some(c => String(r[c.k] ?? "").toLowerCase().includes(f))) : rows;
}
function drawReport(){
  const def = REPORTS[REPORT.key]; if(!def || !$("reportTable")) return;
  const rows = reportRows(def, REPORT.rows, $("reportFilter")?.value || "");
  let footer = null;
  if(def.totals && rows.length) footer = def.cols.map((c,i) => i === 0 ? raw("<b>Total</b>") : (c.t === "num" || c.t === "money")
    ? raw(`<b>${fmtCell(c.t, rows.reduce((s,r) => s + Number(r[c.k] || 0), 0))}</b>`) : "");
  $("reportTable").innerHTML = table(def.cols.map(c => c.h), rows.map(r => def.cols.map(c => fmtCell(c.t, r[c.k]))), footer);
  $("reportMeta").textContent = `${rows.length.toLocaleString("en-IN")} of ${REPORT.rows.length.toLocaleString("en-IN")} rows`;
}
async function drawAgingSummary(rows){
  const box = $("agingSummary"); if(!box) return;
  const all = await allVehicles();
  const c = {bill:0, delivered:0}; all.forEach(v => { const st = vStage(v); if(c[st] !== undefined) c[st]++; });
  const b = {}; rows.forEach(r => { b[r.aging_bucket] = (b[r.aging_bucket] || 0) + 1; });
  const n = v => Number(v || 0).toLocaleString("en-IN");
  box.innerHTML = `<b>Total Order Stock ${n(all.length)} − Bill / Not Delivered ${n(c.bill)} − Delivered ${n(c.delivered)} = Total Vehicles ${n(rows.length)}</b>
    <p>${AGING_BUCKETS.filter(k => b[k]).map(k => `${esc(k)}: <b>${n(b[k])}</b>`).join(" &nbsp;•&nbsp; ") || "No vehicles"}</p>`;
}
async function renderReport(page){
  const def = REPORTS[page];
  if(!def){ $("content").innerHTML = `<div class="panel">${emptyState("Unknown report.")}</div>`; return; }
  REPORT.key = page; REPORT.rows = [];
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(def.title)}</h3>
    <div class="report-tools"><input id="reportFilter" type="search" placeholder="Filter rows..." aria-label="Filter rows">
    <button class="secondary-btn" type="button" id="reportExport">⤓ Export</button><button class="secondary-btn" type="button" id="reportRefresh">↻ Refresh</button></div></div>
    ${page === "aging-report" ? `<div id="agingSummary" class="notice" style="margin-bottom:12px">Loading...</div>` : ""}
    <div class="table-wrap" id="reportTable">${emptyState("Loading live report...")}</div><div class="pager"><span id="reportMeta"></span></div></div>`;
  $("reportFilter").addEventListener("input", drawReport);
  $("reportRefresh").addEventListener("click", () => loadReport(page));
  $("reportExport").addEventListener("click", () => {
    const rows = reportRows(def, REPORT.rows, $("reportFilter").value);
    if(!rows.length){ toast("Nothing to export.","error"); return; }
    exportSheet(page, def.cols.map(c => c.h), rows.map(r => def.cols.map(c => (c.t === "num" || c.t === "money") ? Number(r[c.k] || 0) : (r[c.k] ?? ""))));
  });
  await loadReport(page);
}
async function loadReport(page){
  const def = REPORTS[page]; if(!def) return;
  if(!state.supabase){ $("reportTable").innerHTML = emptyState("Connect Supabase to load live report."); return; }
  try {
    const rows = await computedRows(def.source);
    if(def.sort){ const [k,dir] = def.sort; rows.sort((a,b) => { const x = a[k], y = b[k];
      const c = (typeof x === "number" && typeof y === "number") ? x - y : String(x ?? "").localeCompare(String(y ?? "")); return dir === "desc" ? -c : c; }); }
    REPORT.rows = rows;
    drawReport();
    if(page === "aging-report") drawAgingSummary(rows);
  } catch(err){ $("reportTable").innerHTML = emptyState(err.message); }
}

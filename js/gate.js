"use strict";
/* =====================================================================
   GATE: Bhilarwadi / Branch In-Out, In-Out Register, Gate Pass, scanner
   ===================================================================== */

const GATE_HELP = "VIN चे शेवटचे 6 digits टाका → Purchase Report suggestions. Match नसेल तर manual entry.";
const GATE_COLS = ["#","Date","Movement","Vehicle No.","VIN Number","Engine No.","Variant","Color","Finance Bank","Reason","Driver","Remarks"];

function renderGate(page){
  if(page === "register") return renderGateRegister();
  if(page === "gate-pass") return renderGatePass();
  const title = page === "bhilarwadi" ? "Bhilarwadi In / Out" : "Branch Vehicle In / Out";
  const gateName = page === "bhilarwadi" ? "Bhilarwadi" : "Branch";
  state.gateSelectedVehicleId = null;
  $("content").innerHTML = `
  <div class="gate-page gate-compact-shared">
    <div class="panel gate-entry-panel">
      <div class="gate-panel-head"><h3>${esc(title)}</h3><button class="primary-btn gate-new-btn" type="button" id="gateNewEntry">＋ New Entry</button></div>
      <form id="gateForm" class="gate-form-grid">
        <input type="hidden" name="gate_name" value="${esc(gateName)}">
        <div class="gate-field gate-vehicle-field"><label for="gateVehicleNo">VEHICLE NO. <span>*</span></label><div class="gate-input-icon"><input name="vehicle_no" id="gateVehicleNo" required autocomplete="off" placeholder="Enter Vehicle No."><button type="button" id="gateVehicleScan" title="Scan Vehicle No." aria-label="Scan Vehicle No.">▣</button></div></div>
        <div class="gate-field gate-vin-field"><label for="gateVin">VIN NUMBER <span>*</span></label><input name="vin" id="gateVin" required autocomplete="off" placeholder="Enter VIN / last 6 digits"><div id="gateVinSuggestions" class="gate-suggestions"></div></div>
        <div class="gate-field"><label for="gateEngineNo">ENGINE NO.</label><input name="engine_no" id="gateEngineNo" placeholder="Auto / Manual"></div>
        <div class="gate-field"><label for="gateVariant">VARIANT</label><input name="variant" id="gateVariant" placeholder="Auto / Manual"></div>
        <div class="gate-field"><label for="gateColor">COLOR</label><input name="color" id="gateColor" placeholder="Auto / Manual"></div>
        <div class="gate-field"><label for="gateFinanceBank">FINANCE BANK</label><input name="finance_bank" id="gateFinanceBank" placeholder="Auto / Manual"></div>
        <div class="gate-field"><label for="gateMovementType">MOVEMENT <span>*</span></label><select name="movement_type" id="gateMovementType" required><option value="IN">IN</option><option value="OUT">OUT</option></select></div>
        <div class="gate-field"><label for="gateReason">REASON <span>*</span></label><select name="movement_reason" id="gateReason" required><option value="NEW VEHICLE">NEW VEHICLE</option><option value="DEMO CAR">DEMO CAR</option></select></div>
        <div class="gate-field"><label for="gateReceiptDate">RECEIPT DATE <span>*</span></label><input name="receipt_dt" id="gateReceiptDate" type="date" required></div>
        <div class="gate-field"><label for="gateDriver">DRIVER NAME</label><input name="driver_name" id="gateDriver" autocomplete="off"></div>
        <div class="gate-field"><label for="gateDriverMobile">DRIVER MOBILE</label><input name="driver_mobile" id="gateDriverMobile" inputmode="tel" autocomplete="off"></div>
        <div class="gate-field gate-remarks-field"><label for="gateRemarks">REMARKS</label><textarea name="remarks" id="gateRemarks" placeholder="Enter remarks"></textarea></div>
        <div class="gate-form-actions"><span id="purchaseLookupMsg" class="form-help">${GATE_HELP}</span><div class="gate-action-buttons"><button class="secondary-btn" type="button" id="gateClear">↻ Clear</button><button class="primary-btn" type="submit" id="gateSave">▣ Save Gate Movement</button></div></div>
      </form>
    </div>
    <div class="panel gate-recent-panel"><div class="gate-recent-head"><h3>Recent Gate Movements</h3>${gateFiltersHtml()}</div><div id="recentGateMovements" class="table-wrap"></div></div>
    <div id="modal"></div>
  </div>`;
  $("gateReceiptDate").value = todayLocal();
  $("gateForm").addEventListener("submit", saveGate);
  $("gateClear").addEventListener("click", clearGateForm);
  $("gateNewEntry").addEventListener("click", clearGateForm);
  $("gateVehicleScan").addEventListener("click", startVehicleNumberScanner);
  let lookupTimer;
  $("gateVin").addEventListener("input", () => { clearTimeout(lookupTimer); lookupTimer = setTimeout(() => loadPurchaseVehicleDetails($("gateVin").value.trim(), true), 250); });
  $("gateVin").addEventListener("blur", () => setTimeout(hideGateSuggestions, 180));
  bindGateFilters(loadRecentGateMovements);
  return loadRecentGateMovements();
}

function gateFiltersHtml(){
  return `<div class="gate-filters"><input id="gateSearchText" type="search" placeholder="VIN / Vehicle No." aria-label="Search VIN or vehicle number"><input id="gateFromDate" type="date" title="From Date" aria-label="From date"><span>→</span><input id="gateToDate" type="date" title="To Date" aria-label="To date">
    <select id="gateMovementFilter" aria-label="Movement"><option value="ALL">All</option><option value="IN">IN</option><option value="OUT">OUT</option></select>
    <button class="primary-btn" type="button" id="gateSearch">⌕ Search</button><button class="secondary-btn" type="button" id="gateExport">⤓ Export</button></div>`;
}
function bindGateFilters(loader){
  $("gateSearch").addEventListener("click", loader);
  $("gateSearchText").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); loader(); } });
  $("gateExport").addEventListener("click", exportGateRows);
}

function hideGateSuggestions(){ const el = $("gateVinSuggestions"); if(el) el.innerHTML = ""; }
function vehicleFieldValue(v, keys){
  for(const k of keys) if(v && v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== "") return v[k];
  return "";
}
function setLookupMsg(text, cls){ const el = $("purchaseLookupMsg"); if(el){ el.textContent = text; el.className = "form-help" + (cls ? " " + cls : ""); } }

async function loadPurchaseVehicleDetails(value, showSuggestions = true){
  if(!state.supabase || !value) return;
  const input = cleanQuery(value).replace(/\s+/g,"").toUpperCase();
  if(input.length < 3){ hideGateSuggestions(); return; }
  const r = await state.supabase.from("vehicles").select("*").ilike("vin", `%${input.length >= 6 ? input.slice(-6) : input}%`).limit(20);
  if(r.error){ setLookupMsg("Purchase Report lookup unavailable. Manual entry enabled.","error-text"); hideGateSuggestions(); return; }
  const rows = r.data || [];
  if(showSuggestions){
    const box = $("gateVinSuggestions");
    if(box){
      box.innerHTML = rows.length ? rows.slice(0,10).map((v,i) => {
        const desc = [vehicleFieldValue(v,["model","model_name"]), vehicleFieldValue(v,["variant","variant_name"]), vehicleFieldValue(v,["color","colour"])].filter(Boolean).join(" • ");
        return `<button type="button" class="gate-suggestion" data-suggestion-index="${i}"><strong class="mono">${esc(vehicleFieldValue(v,["vin"]))}</strong><span>${esc(desc)}</span></button>`;
      }).join("") : `<div class="gate-suggestion-empty">No Purchase Report match — manual entry enabled.</div>`;
      box.querySelectorAll(".gate-suggestion").forEach(btn => btn.addEventListener("mousedown", ev => { ev.preventDefault(); applyPurchaseVehicle(rows[Number(btn.dataset.suggestionIndex)]); }));
    }
  }
  if(rows.length === 1 && input.length >= 6) applyPurchaseVehicle(rows[0]);
}
function applyPurchaseVehicle(v){
  state.gateSelectedVehicleId = v?.id || null;
  const set = (id, keys) => { if($(id)) $(id).value = vehicleFieldValue(v, keys); };
  set("gateEngineNo", ["engine_no","engine_number","engineNo"]);
  set("gateVariant", ["variant","variant_name"]);
  set("gateColor", ["color","colour"]);
  set("gateFinanceBank", ["finance_company","finance_bank","finance","bank_name"]);
  set("gateVin", ["vin"]);
  setLookupMsg("Purchase Report match found. Vehicle No. remains manual / scan entry.","success-text");
  hideGateSuggestions();
}

async function startVehicleNumberScanner(){
  const target = $("gateVehicleNo"); if(!target) return;
  if("BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia){
    try {
      const detector = new BarcodeDetector({formats:["code_128","code_39","qr_code","data_matrix","ean_13","ean_8"]});
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
      const wrap = document.createElement("div");
      wrap.className = "scanner-modal";
      wrap.innerHTML = `<div class="scanner-card"><div class="scanner-head"><b>Scan Vehicle No.</b><button type="button" id="scannerClose" aria-label="Close">×</button></div><video id="scannerVideo" autoplay playsinline muted></video><small>Barcode / QR camera scan</small></div>`;
      document.body.appendChild(wrap);
      const video = wrap.querySelector("video");
      video.srcObject = stream;
      const close = () => { stream.getTracks().forEach(t => t.stop()); wrap.remove(); };
      wrap.querySelector("#scannerClose").addEventListener("click", close);
      const scan = async () => {
        if(!document.body.contains(wrap)) return;
        try {
          const codes = await detector.detect(video);
          if(codes[0]?.rawValue){ target.value = codes[0].rawValue.trim(); target.dispatchEvent(new Event("input",{bubbles:true})); close(); return; }
        } catch { /* keep scanning */ }
        requestAnimationFrame(scan);
      };
      video.addEventListener("loadeddata", scan, {once:true});
      return;
    } catch { /* camera denied / unsupported: fall through to manual entry */ }
  }
  target.focus();
  toast("Camera barcode scanning is not available in this browser. Enter the Vehicle No. manually.","error");
}

function clearGateForm(){
  const form = $("gateForm"); if(!form) return;
  form.reset();
  state.gateSelectedVehicleId = null;
  $("gateReceiptDate").value = todayLocal();
  hideGateSuggestions();
  setLookupMsg(GATE_HELP);
}

async function saveGate(e){
  e.preventDefault();
  if(!state.supabase){ toast("Connect Supabase first.","error"); return; }
  const btn = $("gateSave"); btn.disabled = true;
  try {
    const f = Object.fromEntries(new FormData(e.target).entries());
    const vin = (f.vin || "").trim().toUpperCase().replace(/\s+/g,""), vehicleNo = (f.vehicle_no || "").trim().toUpperCase();
    if(!vehicleNo){ toast("Enter or scan Vehicle No.","error"); return; }
    if(!vin){ toast("Enter VIN number or last 6 digits.","error"); return; }

    let vehicleId = state.gateSelectedVehicleId || null, vehicle = null;
    const exact = await state.supabase.from("vehicles").select("id,vin").eq("vin", vin).maybeSingle();
    if(!exact.error && exact.data){ vehicleId = exact.data.id; vehicle = exact.data; }
    else if(!vehicleId && vin.length >= 6){
      const find = await state.supabase.from("vehicles").select("id,vin").ilike("vin", `%${vin.slice(-6)}%`).limit(2);
      if(!find.error && find.data?.length === 1){ vehicleId = find.data[0].id; vehicle = find.data[0]; }
    }
    const finalVin = vehicle?.vin || vin;

    // Safety net: same VIN twice in a row with the same movement is almost always a mistake.
    const last = await state.supabase.from("gate_movements").select("movement_type,receipt_dt").eq("vin", finalVin).order("created_at",{ascending:false}).limit(1);
    if(!last.error && last.data?.[0]?.movement_type === f.movement_type &&
       !confirm(`Last movement for this VIN was also ${f.movement_type} (${fmtD(last.data[0].receipt_dt)}). Save anyway?`)) return;

    const nn = v => { const t = String(v ?? "").trim(); return t === "" ? null : t; };
    const payload = {vehicle_id:vehicleId, vehicle_no:vehicleNo, vin:finalVin, engine_no:nn(f.engine_no), variant:nn(f.variant), color:nn(f.color),
      finance_bank:nn(f.finance_bank), movement_type:f.movement_type, movement_reason:f.movement_reason, receipt_dt:nn(f.receipt_dt),
      remarks:nn(f.remarks), gate_name:nn(f.gate_name), driver_name:nn(f.driver_name), driver_mobile:nn(f.driver_mobile)};
    const ins = await state.supabase.from("gate_movements").insert(payload);
    if(ins.error){ toast(ins.error.message,"error"); return; }
    toast(vehicleId ? "Gate movement saved." : "Gate movement saved with manual vehicle details.","success");
    clearGateForm();
    await loadRecentGateMovements();
  } finally { btn.disabled = false; }
}

/* ---- Shared movement query (recent list, register, gate pass) ---------------- */
let GATE_ROWS = [];
async function fetchGateRows(limit = 100){
  const q = cleanQuery($("gateSearchText")?.value).replace(/\s+/g,"");
  const from = $("gateFromDate")?.value, to = $("gateToDate")?.value, movement = $("gateMovementFilter")?.value;
  let query = state.supabase.from("gate_movements").select("*").order("created_at",{ascending:false}).limit(limit);
  if(from) query = query.gte("receipt_dt", from);
  if(to) query = query.lte("receipt_dt", to);
  if(movement && movement !== "ALL") query = query.eq("movement_type", movement);
  if(q) query = query.or(`vin.ilike.%${q}%,vehicle_no.ilike.%${q}%`);
  const r = await query;
  if(r.error) throw r.error;
  const rows = r.data || [];
  const ids = [...new Set(rows.map(x => x.vehicle_id).filter(Boolean))];
  const vmap = {};
  if(ids.length){
    const vr = await state.supabase.from("vehicles").select("id,vin,vehicle_no,engine_no,variant,color,finance_company").in("id", ids);
    (vr.data || []).forEach(v => { vmap[v.id] = v; });
  }
  return rows.map(x => { const v = vmap[x.vehicle_id] || {}; return {...x,
    vin: x.vin || v.vin, vehicle_no: x.vehicle_no || v.vehicle_no, engine_no: x.engine_no || v.engine_no,
    variant: x.variant || v.variant, color: x.color || v.color, finance_bank: x.finance_bank || v.finance_company}; });
}
function gatePlainRow(x, i){
  return [i + 1, fmtD(x.receipt_dt || x.created_at), x.movement_type, x.vehicle_no, x.vin, x.engine_no, x.variant, x.color, x.finance_bank, x.movement_reason,
    [x.driver_name, x.driver_mobile].filter(Boolean).join(" / "), x.remarks];
}
function exportGateRows(){
  if(!GATE_ROWS.length){ toast("Nothing to export.","error"); return; }
  exportSheet("gate-movements", GATE_COLS, GATE_ROWS.map(gatePlainRow));
}

async function loadRecentGateMovements(){
  const target = $("recentGateMovements"); if(!target) return;
  if(!state.supabase){ target.innerHTML = emptyState("Connect Supabase to view gate movements."); return; }
  try {
    GATE_ROWS = await fetchGateRows(100);
    const editable = state.isAdmin;      // UPDATE/DELETE are Admin-only in the database policies
    target.innerHTML = table(editable ? [...GATE_COLS, "Action"] : GATE_COLS, GATE_ROWS.map((x,i) => {
      const row = gatePlainRow(x, i);
      return editable ? [...row, raw(`<button class="table-icon-btn" type="button" title="Edit" aria-label="Edit" data-gate-edit="${i}">✎</button><button class="table-icon-btn danger" type="button" title="Delete" aria-label="Delete" data-gate-del="${i}">🗑</button>`)] : row;
    }));
    target.querySelectorAll("[data-gate-edit]").forEach(b => b.addEventListener("click", () => openGateEdit(GATE_ROWS[Number(b.dataset.gateEdit)])));
    target.querySelectorAll("[data-gate-del]").forEach(b => b.addEventListener("click", () => deleteGateMovement(GATE_ROWS[Number(b.dataset.gateDel)])));
  } catch(err){ target.innerHTML = emptyState("Gate movements unavailable: " + err.message); }
}

function openGateEdit(x){
  if(!x) return;
  $("modal").innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Edit gate movement">
    <div class="panel-head"><h3>Edit Gate Movement</h3><button class="icon-btn" type="button" id="modalClose" aria-label="Close">×</button></div>
    <form id="gateEditForm" class="form-grid">
      <div><label>VIN</label><input value="${esc(x.vin || "")}" disabled></div>
      <div><label for="ge_no">VEHICLE NO.</label><input id="ge_no" name="vehicle_no" value="${esc(x.vehicle_no || "")}" required></div>
      <div><label for="ge_date">RECEIPT DATE</label><input id="ge_date" name="receipt_dt" type="date" value="${esc(x.receipt_dt || "")}"></div>
      <div><label for="ge_type">MOVEMENT</label><select id="ge_type" name="movement_type"><option ${x.movement_type === "IN" ? "selected" : ""}>IN</option><option ${x.movement_type === "OUT" ? "selected" : ""}>OUT</option></select></div>
      <div><label for="ge_reason">REASON</label><select id="ge_reason" name="movement_reason"><option ${x.movement_reason === "NEW VEHICLE" ? "selected" : ""}>NEW VEHICLE</option><option ${x.movement_reason === "DEMO CAR" ? "selected" : ""}>DEMO CAR</option></select></div>
      <div class="full"><label for="ge_rem">REMARKS</label><textarea id="ge_rem" name="remarks">${esc(x.remarks || "")}</textarea></div>
      <div class="full form-actions"><button type="button" class="secondary-btn" id="modalCancel">Cancel</button><button class="primary-btn" type="submit">Save Changes</button></div>
    </form></div></div>`;
  $("modalClose").addEventListener("click", closeModal);
  $("modalCancel").addEventListener("click", closeModal);
  $("gateEditForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const upd = {vehicle_no:f.vehicle_no.trim().toUpperCase(), receipt_dt:f.receipt_dt || null, movement_type:f.movement_type, movement_reason:f.movement_reason, remarks:f.remarks.trim() || null};
    const r = await state.supabase.from("gate_movements").update(upd).eq("id", x.id).select("id");
    if(r.error){ toast(r.error.message,"error"); return; }
    if(!r.data?.length){ toast("Not updated — you may not have permission.","error"); return; }
    logAudit("UPDATE_GATE_MOVEMENT","gate","gate_movements",x.id,{vin:x.vin,...upd});
    toast("Gate movement updated.","success"); closeModal(); loadRecentGateMovements();
  });
}
async function deleteGateMovement(x){
  if(!x || !confirm(`Delete this ${x.movement_type} entry for ${x.vin || x.vehicle_no}? This cannot be undone.`)) return;
  const r = await state.supabase.from("gate_movements").delete().eq("id", x.id).select("id");
  if(r.error){ toast(r.error.message,"error"); return; }
  if(!r.data?.length){ toast("Not deleted — you may not have permission.","error"); return; }
  logAudit("DELETE_GATE_MOVEMENT","gate","gate_movements",x.id,{vin:x.vin,vehicle_no:x.vehicle_no,movement:x.movement_type});
  toast("Entry deleted.","success"); loadRecentGateMovements();
}

/* ---- In-Out Register ------------------------------------------------------------ */
async function renderGateRegister(){
  $("content").innerHTML = `<div class="panel gate-recent-panel"><div class="gate-recent-head"><h3>In-Out Register</h3>${gateFiltersHtml()}</div><div id="gateRegister" class="table-wrap">${emptyState("Loading...")}</div></div>`;
  bindGateFilters(loadGateRegister);
  return loadGateRegister();
}
async function loadGateRegister(){
  const box = $("gateRegister"); if(!box) return;
  if(!state.supabase){ box.innerHTML = emptyState("Connect Supabase to view the register."); return; }
  try {
    GATE_ROWS = await fetchGateRows(500);
    box.innerHTML = table(GATE_COLS, GATE_ROWS.map(gatePlainRow));
  } catch(err){ box.innerHTML = emptyState("Register unavailable: " + err.message); }
}

/* ---- Gate Pass (printable) ----------------------------------------------------------- */
function renderGatePass(){
  $("content").innerHTML = `<div class="panel gate-recent-panel"><div class="gate-recent-head"><h3>Gate Pass</h3>
    <div class="gate-filters"><input id="gateSearchText" type="search" placeholder="VIN / Vehicle No." aria-label="Search VIN or vehicle number"><button class="primary-btn" type="button" id="gateSearch">⌕ Find</button></div></div>
    <p class="form-help gatepass-help">Search a vehicle, then print the gate pass for a recorded movement.</p><div id="gatePassResults" class="table-wrap">${emptyState("Search by VIN or vehicle number.")}</div></div>`;
  const run = async () => {
    const box = $("gatePassResults");
    if(!$("gateSearchText").value.trim()){ box.innerHTML = emptyState("Enter a VIN or vehicle number."); return; }
    try {
      GATE_ROWS = await fetchGateRows(20);
      box.innerHTML = table([...GATE_COLS.slice(0,10), "Print"], GATE_ROWS.map((x,i) => [...gatePlainRow(x,i).slice(0,10), raw(`<button class="secondary-btn" type="button" data-pass="${i}">🖨 Print</button>`)]));
      box.querySelectorAll("[data-pass]").forEach(b => b.addEventListener("click", () => printGatePass(GATE_ROWS[Number(b.dataset.pass)])));
    } catch(err){ box.innerHTML = emptyState(err.message); }
  };
  $("gateSearch").addEventListener("click", run);
  $("gateSearchText").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); run(); } });
}
function printGatePass(x){
  if(!x) return;
  const w = window.open("", "gatepass", "width=820,height=900");
  if(!w){ toast("Allow pop-ups to print the gate pass.","error"); return; }
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || "-")}</td></tr>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Gate Pass</title>
  <style>body{font-family:Inter,"Segoe UI",Arial,sans-serif;padding:32px;color:#111}h1{margin:0;font-size:22px}h2{margin:4px 0 20px;font-size:14px;font-weight:600;color:#555}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:10px 12px;text-align:left;font-size:14px}th{width:32%;background:#f3f4f6}
  .sign{display:flex;justify-content:space-between;margin-top:70px;font-size:13px}.sign div{border-top:1px solid #333;padding-top:6px;width:30%;text-align:center}
  .tag{display:inline-block;padding:3px 10px;border:1px solid #111;border-radius:4px;font-weight:700}</style></head><body>
  <h1>KOTHARI HYUNDAI</h1><h2>Vehicle Gate Pass &nbsp; <span class="tag">${esc(x.movement_type || "")}</span></h2>
  <table>${row("Date", fmtD(x.receipt_dt || x.created_at))}${row("Gate", x.gate_name)}${row("Vehicle No.", x.vehicle_no)}${row("VIN", x.vin)}${row("Engine No.", x.engine_no)}
  ${row("Variant", x.variant)}${row("Color", x.color)}${row("Finance Bank", x.finance_bank)}${row("Reason", x.movement_reason)}${row("Driver", [x.driver_name, x.driver_mobile].filter(Boolean).join(" / "))}${row("Remarks", x.remarks)}</table>
  <div class="sign"><div>Prepared by</div><div>Security</div><div>Authorised signatory</div></div></body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}

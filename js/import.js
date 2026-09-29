"use strict";
/* =====================================================================
   IMPORT: Order report -> Pending Order | Purchase report -> In Transit
           Sales report -> Delivered | Import history
   Column mapping comes from EXCEL_FIELDS (js/fields.js) = Excel headings.
   ===================================================================== */
const IMPORT_TYPES = {
  "order-import":    {key:"ORDER",    status:"Pending Order", title:"Order Report Import"},
  "purchase-import": {key:"PURCHASE", status:"In Transit",    title:"Purchase Report Import"},
  "sales-import":    {key:"SALES",    status:"Delivered",     title:"Sales Report Import"}
};
const STATUS_MOVABLE = ["", "pending order", "in transit"];   // purchase import never pulls later stages back
const SQL_HINT = "Database columns are missing. Run IMPORT_COLUMNS_FIX.sql once in Supabase SQL Editor, then import again.";
let importRows = [];
const importDropped = new Set();                              // columns the database does not have (skipped safely)

function importNorm(h){ return String(h ?? "").toLowerCase().replace(/%/g," pct ").replace(/[^a-z0-9]+/g," ").trim(); }
const IMPORT_HEADER_MAP = (() => {                            // normalised Excel header -> [db column, type]
  const m = new Map();
  EXCEL_FIELDS.forEach(([k, heading, type, extra = []]) => [heading, ...extra].forEach(a => { if(!m.has(importNorm(a))) m.set(importNorm(a), [k, type]); }));
  return m;
})();
function importDate(v){
  if(v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  const s = String(v ?? "").trim();
  let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);           // portal exports use dd/mm/yyyy
  if(m){ const [d, mo, y] = [+m[1], +m[2], +m[3]]; return (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) ? null : `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function importNum(v){ const n = Number(String(v ?? "").replace(/[^\d.\-]/g,"")); return isFinite(n) ? n : 0; }

/** One Excel row -> record keyed by database column names (typed, blanks removed). */
function importMap(raw){
  const r = {};
  for(const [header, value] of Object.entries(raw)){
    const hit = IMPORT_HEADER_MAP.get(importNorm(header)); if(!hit) continue;
    const [k, type] = hit;
    if(value instanceof Date ? isNaN(value) : isBlank(String(value).trim())) continue;
    if(k in r) continue;                                       // first matching header wins
    if(type === "date"){ const d = importDate(value); if(d) r[k] = d; }
    else if(type === "money" || type === "num") r[k] = importNum(value);
    else r[k] = String(value).trim();
  }
  if(r.model && MODEL_ALIASES[r.model.toLowerCase()]) r.model = MODEL_ALIASES[r.model.toLowerCase()];
  if(r.vin) r.vin = r.vin.replace(/\s+/g,"").toUpperCase();
  if(r.engine_no) r.engine_no = r.engine_no.replace(/\s+/g,"").toUpperCase();
  if(r.order_no && /^\d+$/.test(r.order_no) && r.order_no.length < 10) r.order_no = r.order_no.padStart(10,"0");
  if(!r.dealer_code && r.pis_no) r.dealer_code = r.pis_no.slice(0,5).toUpperCase();   // PIS No W2203FH591 -> dealer W2203
  return r;
}
/** Record -> database payload. kind: ORDER | PURCHASE */
function importPayload(r, kind, status){
  const p = {};
  for(const [k] of EXCEL_FIELDS) if(r[k] !== undefined && r[k] !== null && r[k] !== "") p[k] = r[k];
  if(p.vin) p.chassis_no = p.vin;
  if(kind === "PURCHASE"){
    if(r.hmi_invoice_amount !== undefined) p.stock_value = r.hmi_invoice_amount;
    if(r.hmi_invoice_date) p.purchase_date = r.hmi_invoice_date;
  } else if(r.order_amount !== undefined) p.stock_value = r.order_amount;
  if(status) p.status = status;
  return p;
}
const importChunks = (arr, n) => { const out = []; for(let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const importIsInvoiced = r => String(r.order_status || "").toLowerCase() === "invoiced";
function importDedupe(rows, keyOf){ const m = new Map(); rows.forEach((r, i) => m.set(keyOf(r) || "row" + i, r)); return [...m.values()]; }

/* ---- Safe writes: a column the database lacks is skipped (and reported), never a hard error ---- */
const importStrip = p => Object.fromEntries(Object.entries(p).filter(([k]) => !importDropped.has(k)));
function importMissingColumn(err){
  const msg = String(err?.message || "");
  if(!/does not exist|schema cache|could not find/i.test(msg)) return null;
  const m = /the '([a-z0-9_]+)' column/i.exec(msg) || /column "?(?:vehicles\.)?([a-z0-9_]+)"?/i.exec(msg);
  return m ? m[1] : null;
}
async function importWrite(run, payload){
  for(let i = 0; i < 80; i++){
    const r = await run(Array.isArray(payload) ? payload.map(importStrip) : importStrip(payload));
    if(!r.error) return r;
    const c = importMissingColumn(r.error);
    if(!c || importDropped.has(c) || ["vin","order_no","status"].includes(c)) return r;
    importDropped.add(c);
  }
  return {error:{message:"Too many missing columns. " + SQL_HINT}};
}

async function importFetchExisting(rows){
  const sb = state.supabase, byOrder = new Map(), byVin = new Map();
  const load = async (col, values) => {
    for(const part of importChunks([...new Set(values)], 80)){
      const {data, error} = await sb.from("vehicles").select("id,vin,order_no,status").in(col, part);
      if(error) throw error;
      (data || []).forEach(v => { if(v.order_no) byOrder.set(v.order_no, v); if(v.vin) byVin.set(v.vin, v); });
    }
  };
  await load("order_no", rows.map(r => r.order_no).filter(Boolean));
  await load("vin", rows.map(r => r.vin).filter(Boolean));
  return {byOrder, byVin};
}
const importFind = (ex, r) => (r.order_no && ex.byOrder.get(r.order_no)) || (r.vin && ex.byVin.get(r.vin)) || null;

async function renderImport(page){
  if(page === "import-history") return renderImportHistory();
  const t = IMPORT_TYPES[page]; importRows = [];
  const rule = {
    ORDER: "File: <b>SaleDealerOrderStatus.xlsx</b>. Status <b>Ordered / Allocated</b> → <b>Pending Order</b>. <b>Invoiced</b> rows are added as <b>In Transit</b> (HMI invoice already raised). If the vehicle already exists (e.g. from the Purchase Report) its order details are filled in and its status is not changed.",
    PURCHASE: "File: <b>VehicleDeliveryStatusReport.xlsx</b>. Imported as <b>In Transit</b>. If the <b>Order No</b> (or VIN) exists as Pending Order it moves to In Transit. In Stock / Delivered vehicles keep their status.",
    SALES: "Vehicles matched by <b>VIN</b> are marked <b>Delivered</b>."
  }[t.key];
  $("content").innerHTML = `<div class="panel import-panel"><div class="panel-head"><h3>${esc(t.title)}</h3></div>
    <p class="form-help">${rule}</p>
    <div class="dropzone"><input id="fileInput" type="file" accept=".csv,.xlsx,.xls"><div><button class="secondary-btn" id="importPreview" type="button">Preview</button> <button class="primary-btn" id="importGo" type="button" disabled>Import</button></div></div>
    <div id="importMsg" class="message"></div><div id="importPreviewBox" class="table-wrap"></div></div>`;
  $("importPreview").addEventListener("click", () => importPreviewFile(page));
  $("importGo").addEventListener("click", () => importRun(page));
}
async function importPreviewFile(page){
  const f = $("fileInput").files[0], t = IMPORT_TYPES[page], msg = $("importMsg");
  if(!f) return toast("Select a file first.","error");
  if(!window.XLSX) return toast("Excel library not loaded (check internet).","error");
  let raw;
  try { const wb = XLSX.read(await f.arrayBuffer(), {type:"array", cellDates:true}); raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:""}); }
  catch { msg.textContent = "This file could not be read. Upload the original .xlsx / .csv report."; msg.className = "message error"; return; }
  const key = t.key === "SALES" ? r => r.vin : t.key === "ORDER" ? r => r.order_no : r => r.vin;
  importRows = importDedupe(raw.map(importMap).filter(r => r.order_no || r.vin), key);
  const unmapped = raw.length ? Object.keys(raw[0]).filter(h => !IMPORT_HEADER_MAP.has(importNorm(h)) && importNorm(h) !== "s no" && importNorm(h) !== "no") : [];
  const bad = importRows.filter(r => !key(r)).length;
  let info = `${importRows.length} rows read.`;
  if(t.key === "ORDER"){ const inv = importRows.filter(importIsInvoiced).length; info += ` ${importRows.length - inv} → Pending Order, ${inv} Invoiced → In Transit.`; }
  try {
    if(t.key !== "SALES"){
      const ex = await importFetchExisting(importRows), hit = importRows.filter(r => importFind(ex, r)).length;
      info += t.key === "PURCHASE" ? ` ${hit} match existing stock, ${importRows.length - hit} new.` : ` ${hit} already in system.`;
    }
  } catch(err){ info += " " + (importMissingColumn(err) ? SQL_HINT : "(Could not check existing stock: " + (err.message || err) + ")"); }
  if(bad) info += ` ${bad} rows have no ${t.key === "ORDER" ? "Order No" : "VIN"} and will be skipped.`;
  if(unmapped.length) info += ` Ignored columns: ${unmapped.join(", ")}.`;
  msg.textContent = info; msg.className = "message" + (bad ? " error" : " success");
  const cols = ["order_no","vin","engine_no","model","variant","color","dealer_code","finance_company","hmi_invoice_date","order_status","stock_value"];
  const shown = t.key === "SALES" ? cols.slice(0,6) : cols;
  $("importPreviewBox").innerHTML = table(shown.map(c => FIELD_HEADING[c]), importRows.slice(0,15).map(r => shown.map(c => c === "stock_value" ? (r.hmi_invoice_amount ?? r.order_amount) : r[c])));
  $("importGo").disabled = !importRows.length;
}
async function importInsertRows(rows, res){
  const sb = state.supabase;
  for(const part of importChunks(rows, 50)){
    const r = await importWrite(b => sb.from("vehicles").insert(b), part);
    if(!r.error){ res.added += part.length; continue; }
    for(const one of part){                                    // isolate the bad row(s)
      const x = await importWrite(b => sb.from("vehicles").insert(b), one);
      if(x.error){ res.failed++; res.firstError ||= x.error.message; } else res.added++;
    }
  }
}
async function importRunRows(key, rows){
  const sb = state.supabase, res = {added:0, updated:0, moved:0, skipped:0, invoiced:0, failed:0, firstError:""};
  if(key === "SALES"){
    for(const r of rows){
      if(!r.vin){ res.failed++; continue; }
      const {data, error} = await sb.from("vehicles").update({status: IMPORT_TYPES["sales-import"].status}).eq("vin", r.vin).select("id");
      if(error){ res.failed++; res.firstError ||= error.message; } else if(data?.length) res.updated++; else { res.failed++; res.firstError ||= "VIN not found in stock"; }
    }
    return res;
  }
  const ex = await importFetchExisting(rows), fresh = [], updates = [];
  if(key === "ORDER"){
    for(const r of rows){
      if(!r.order_no){ res.failed++; res.firstError ||= "Order No missing"; continue; }
      const cur = importFind(ex, r);
      if(cur){                                                  // fill order details, never touch status / invoice value
        const patch = importPayload(r, "ORDER", ""); delete patch.stock_value; delete patch.purchase_date;
        updates.push({id:cur.id, patch, moved:false}); continue;
      }
      if(importIsInvoiced(r)){ res.invoiced++; fresh.push(importPayload(r, "ORDER", "In Transit")); continue; }   // already invoiced by HMI
      fresh.push(importPayload(r, "ORDER", "Pending Order"));
    }
  } else {
    for(const r of rows){
      if(!r.vin){ res.failed++; res.firstError ||= "VIN missing"; continue; }
      const cur = importFind(ex, r);
      if(!cur){ fresh.push(importPayload(r, "PURCHASE", "In Transit")); continue; }
      const movable = STATUS_MOVABLE.includes(String(cur.status || "").toLowerCase());
      updates.push({id:cur.id, patch:importPayload(r, "PURCHASE", movable ? "In Transit" : ""), moved:String(cur.status || "").toLowerCase() === "pending order"});
    }
  }
  for(const part of importChunks(updates, 10)){
    await Promise.all(part.map(async u => {
      const x = await importWrite(b => sb.from("vehicles").update(b).eq("id", u.id), u.patch);
      if(x.error){ res.failed++; res.firstError ||= x.error.message; } else { res.updated++; if(u.moved) res.moved++; }
    }));
  }
  await importInsertRows(fresh, res);
  return res;
}
async function importRun(page){
  const t = IMPORT_TYPES[page], msg = $("importMsg");
  $("importGo").disabled = true; msg.className = "message"; msg.textContent = "Importing…"; importDropped.clear();
  let res;
  try { res = await importRunRows(t.key, importRows); }
  catch(err){ msg.textContent = importMissingColumn(err) ? SQL_HINT : "Import stopped: " + (err.message || err); msg.className = "message error"; $("importGo").disabled = false; return; }
  if(typeof VCACHE !== "undefined") VCACHE.rows = null;
  const bits = [`${res.added} added`];
  if(t.key === "PURCHASE") bits.push(`${res.updated} updated (${res.moved} moved Pending Order → In Transit)`);
  if(t.key === "ORDER") bits.push(`${res.updated} existing filled`, `${res.invoiced} of the added rows were Invoiced (In Transit)`);
  if(t.key === "SALES") bits.push(`${res.updated} marked Delivered`);
  bits.push(`${res.failed} failed`);
  let text = bits.join(", ") + ".";
  if(res.firstError) text += ` First error: ${res.firstError}` + (importMissingColumn({message:res.firstError}) ? ` — ${SQL_HINT}` : "");
  if(importDropped.size) text += ` Not saved (no such column in database): ${[...importDropped].map(c => FIELD_HEADING[c] || c).join(", ")}. ${SQL_HINT}`;
  msg.textContent = text; msg.className = "message " + (res.failed ? "error" : "success");
  try {
    await importWrite(b => state.supabase.from("import_batches").insert(b), {import_type:t.key, file_name:$("fileInput").files[0]?.name || "", total_rows:importRows.length,
      successful_rows:res.added + res.updated, failed_rows:res.failed, status:res.failed ? "Partial" : "Completed"});
  } catch { /* history is best effort */ }
  logAudit("IMPORT", "import", t.key, null, res);
  toast(`${t.title}: ${res.added + res.updated} ok, ${res.failed} failed`, res.failed ? "error" : "info");
}
async function renderImportHistory(){
  $("content").innerHTML = `<div class="panel"><div class="panel-head"><h3>Import History</h3></div><div id="importHistory" class="table-wrap"></div></div>`;
  const r = await state.supabase.from("import_batches").select("*").order("created_at",{ascending:false}).limit(100);
  $("importHistory").innerHTML = r.error ? emptyState("No import history yet.") :
    table(["Date","Type","File","Rows","Success","Failed","Status"], (r.data||[]).map(x => [fmtDT(x.created_at),x.import_type,x.file_name,x.total_rows,x.successful_rows,x.failed_rows,x.status]));
}

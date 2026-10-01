"use strict";
/* =====================================================================
   UI HELPERS (loaded right after core.js)
   - mountPaged : "Showing 51–100 of 136  ‹ Prev  Page 2 / 3  Next ›" on every list
   - filterBtn / filterPanel : one neat Filter button used on every screen
   - openScanner : camera barcode / QR scan for VIN fields
   - globalVinSearch : VIN search in the top bar (opens vehicle details)
   - storage helpers : signed URLs + download for gate photos / gate passes
   ===================================================================== */

/* ---------------------------------------------------------------- Pagination */
const pageSize = () => parseInt(state.settings?.sys?.vehicle_page_size, 10) || 50;

function pagerHtml(total, page, size){
  const pages = Math.max(1, Math.ceil(total / size)), from = total ? page * size + 1 : 0, to = Math.min(total, (page + 1) * size);
  return `<div class="pager"><span>Showing ${from.toLocaleString("en-IN")}–${to.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}</span>
    <span><button class="secondary-btn" type="button" data-pg="prev" ${page === 0 ? "disabled" : ""}>‹ Prev</button>
    <span class="pager-page">Page ${page + 1} / ${pages}</span>
    <button class="secondary-btn" type="button" data-pg="next" ${page + 1 >= pages ? "disabled" : ""}>Next ›</button></span></div>`;
}
/** Draws a paged table into `el`.
 *  cfg = { headers, rows: array | () => array (each row = array of cells), footer: cells | (allRows) => cells,
 *          size, empty, onDraw(el, pageRows, offset) }   Returns {draw(), reset()} */
function mountPaged(el, cfg){
  let page = 0;
  const size = cfg.size || pageSize();
  const draw = () => {
    if(!el.isConnected) return;
    const rows = typeof cfg.rows === "function" ? cfg.rows() : cfg.rows;
    const pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(page, pages - 1);
    const slice = rows.slice(page * size, page * size + size);
    if(!rows.length){ el.innerHTML = emptyState(cfg.empty || "No records found."); cfg.onDraw?.(el, [], 0); return; }
    const foot = cfg.footer ? (typeof cfg.footer === "function" ? cfg.footer(rows) : cfg.footer) : null;
    el.innerHTML = `<div class="table-scroll">${table(cfg.headers, slice, foot)}</div>${pagerHtml(rows.length, page, size)}`;
    el.querySelector('[data-pg="prev"]').onclick = () => { page--; draw(); };
    el.querySelector('[data-pg="next"]').onclick = () => { page++; draw(); };
    cfg.onDraw?.(el, slice, page * size);
  };
  draw();
  return {draw, reset(){ page = 0; draw(); }};
}

/* ------------------------------------------------------------- Filter button */
const filterBtn = (id, label = "Filter") => `<button type="button" class="filter-btn" data-filter-toggle="${id}" aria-expanded="false">▽ ${esc(label)}<span class="filter-count" hidden></span></button>`;
const filterPanel = (id, inner, open = false) => `<div class="filter-panel" id="${id}" ${open ? "" : "hidden"}>${inner}</div>`;
function filterBadge(panel){
  const btn = document.querySelector(`[data-filter-toggle="${panel.id}"]`); if(!btn) return;
  const n = [...panel.querySelectorAll("input:not([type=checkbox]):not([type=file]), select")].filter(i => i.value && i.value !== "ALL").length;
  const b = btn.querySelector(".filter-count"); b.textContent = n; b.hidden = !n; btn.classList.toggle("on", n > 0);
}
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-filter-toggle]"); if(!b) return;
  const p = document.getElementById(b.dataset.filterToggle); if(!p) return;
  p.hidden = !p.hidden; b.setAttribute("aria-expanded", String(!p.hidden));
});
["input", "change"].forEach(ev => document.addEventListener(ev, e => { const p = e.target.closest?.(".filter-panel"); if(p) filterBadge(p); }));

/* ----------------------------------------------------------- Storage helpers */
const nameOfPath = p => String(p || "").split("/").pop() || "file.jpg";
async function signedUrls(paths, expires = 3600){
  const list = [...new Set((paths || []).filter(Boolean))], out = {};
  if(!list.length || !state.supabase) return out;
  const r = await state.supabase.storage.from(GATE_BUCKET).createSignedUrls(list, expires);
  (r.data || []).forEach(o => { if(o.signedUrl) out[o.path] = o.signedUrl; });
  return out;
}
async function downloadPath(path, fileName){
  try {
    const r = await state.supabase.storage.from(GATE_BUCKET).createSignedUrl(path, 300, {download: fileName || nameOfPath(path)});
    if(r.error || !r.data?.signedUrl) return toast("Download failed: " + (r.error?.message || "file not found"), "error");
    const a = document.createElement("a"); a.href = r.data.signedUrl; a.download = fileName || nameOfPath(path); document.body.appendChild(a); a.click(); a.remove();
  } catch(err){ toast("Download failed: " + (err.message || err), "error"); }
}

/* --------------------------------------------------------------- VIN scanner */
function cleanScan(text){
  return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Hyundai label format:
// VIN line:  MALPA813LTM  (11 characters)
// DIESEL:    340539      (6 digits)
// Complete VIN: MALPA813LTM340539
function buildHyundaiVIN(parts){
  const values = (Array.isArray(parts) ? parts : [parts])
    .map(v => cleanScan(v))
    .filter(Boolean);

  for(const v of values){
    if(/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return v;
  }

  for(const a of values){
    if(!/^[A-HJ-NPR-Z0-9]{11}$/.test(a)) continue;
    for(const b of values){
      if(!/^[0-9]{6}$/.test(b)) continue;
      const vin = a + b;
      if(/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return vin;
    }
  }

  const joined = values.join("");
  const m = joined.match(/([A-HJ-NPR-Z0-9]{11})([0-9]{6})/);
  return m ? m[1] + m[2] : "";
}

function isValidScannedVIN(vin){
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || ""));
}

function openScanner(onResult){
  openModal(`<div class="modal-bg" id="scanBg"><div class="modal scan-modal" role="dialog" aria-modal="true" aria-label="Scan VIN">
    <div class="panel-head"><h3>Scan VIN / Chassis barcode</h3><button class="icon-btn" type="button" id="scanClose" aria-label="Close">×</button></div>
    <video id="scanVideo" playsinline muted autoplay></video><p id="scanMsg" class="form-help">Scan VIN: 11-character VIN part + 6-digit number. Example: MALPA813LTM + 340539</p>
    <div class="form-actions"><label class="secondary-btn scan-photo">📷 Take / choose photo<input id="scanFile" type="file" accept="image/*" capture="environment" hidden></label>
    <button type="button" class="secondary-btn" id="scanCancel">Cancel</button></div></div></div>`);
  const msg = t => { const m = $("scanMsg"); if(m) m.textContent = t; };
  let stream = null, timer = null, zxControls = null, finished = false;
  const stop = () => { finished = true; clearInterval(timer); try { zxControls?.stop(); } catch { /* ignore */ } stream?.getTracks().forEach(t => t.stop()); closeModal(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if(e.key === "Escape") stop(); };
  document.addEventListener("keydown", onKey);
    const scanParts = [];
  const found = text => {
    if(finished) return;

    const v = cleanScan(text);
    if(!v) return;

    // Accept a complete 17-character VIN directly.
    let vin = buildHyundaiVIN([v]);

    // Or combine the Hyundai label's 11-character VIN part + 6-digit part.
    if(!vin){
      scanParts.push(v);
      while(scanParts.length > 4) scanParts.shift();
      vin = buildHyundaiVIN(scanParts);
    }

    if(!isValidScannedVIN(vin)){
      msg("Scan VIN: 11-character VIN part + 6-digit number. Example: MALPA813LTM + 340539");
      return;
    }

    stop();
    onResult(vin);
  };
  $("scanClose").onclick = stop; $("scanCancel").onclick = stop;

  let detector = null;
  if(window.BarcodeDetector){ try { detector = new BarcodeDetector({formats:["code_128","code_39","code_93","qr_code","data_matrix","pdf417","ean_13","itf","codabar"]}); } catch { try { detector = new BarcodeDetector(); } catch { detector = null; } } }

  $("scanFile").addEventListener("change", async e => {              // photo of the barcode
    const f = e.target.files[0]; if(!f) return; msg("Reading photo…");
    try {
      if(detector){ const codes = await detector.detect(await createImageBitmap(f)); if(codes.length) return found(codes[0].rawValue); }
      const Z = await loadZxing(), url = URL.createObjectURL(f);
      try { const r = await new Z.BrowserMultiFormatReader().decodeFromImageUrl(url); return found(r.getText()); } finally { URL.revokeObjectURL(url); }
    } catch { msg("No barcode found in that photo. Try again closer, or type the VIN."); }
  });

  if(!navigator.mediaDevices?.getUserMedia){ msg("Camera not available here (needs https). Use “Take / choose photo” or type the VIN."); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}, audio:false}); }
  catch { msg("Camera permission denied. Use “Take / choose photo” or type the VIN."); return; }
  if(finished){ stream.getTracks().forEach(t => t.stop()); return; }
  const video = $("scanVideo"); video.srcObject = stream; try { await video.play(); } catch { /* autoplay */ }
  if(detector){
    timer = setInterval(async () => { if(finished || video.readyState < 2) return; try { const c = await detector.detect(video); if(c.length) found(c[0].rawValue); } catch { /* keep trying */ } }, 300);
  } else {
    try {
      const Z = await loadZxing(); stream.getTracks().forEach(t => t.stop()); stream = null;
      if(finished) return;
      zxControls = await new Z.BrowserMultiFormatReader().decodeFromVideoDevice(undefined, "scanVideo", res => { if(res) found(res.getText()); });
    } catch { msg("Live scan is not supported on this browser. Use “Take / choose photo” or type the VIN."); }
  }
}

/* ------------------------------------------- Vehicle details + top-bar VIN search */
function openVehicleDetails(v){
  const keys = [...VEHICLE_EXPORT_COLS], rows = keys.filter(k => !isBlank(v[k])).map(k => [FIELD_HEADING[k], k === "status" ? statusBadge(v[k]) : fmtCell(FIELD_TYPE[k], v[k])]);
  if(v.location_id) rows.push(["Location", locName(v.location_id)]);
  openModal(`<div class="modal-bg" id="vdBg"><div class="modal" role="dialog" aria-modal="true" aria-label="Vehicle details">
    <div class="panel-head"><h3 class="mono">${esc(v.vin || v.order_no || "Vehicle")}</h3><div class="report-tools">${can("documents") ? `<button class="secondary-btn" type="button" id="vdDocs">📄 Documents</button>` : ""}<button class="icon-btn" type="button" id="modalClose" aria-label="Close">×</button></div></div>
    <div class="table-wrap">${table(["Field","Value"], rows)}</div></div></div>`);
  $("modalClose").onclick = closeModal; $("vdBg").addEventListener("mousedown", e => { if(e.target.id === "vdBg") closeModal(); });
  if($("vdDocs")) $("vdDocs").onclick = () => { state.docVin = v.vin; closeModal(); navigate("documents"); };
}
async function globalVinSearch(e){
  e?.preventDefault();
  const input = $("globalVin"), q = cleanQuery(input.value).replace(/\s+/g, "").toUpperCase();
  if(q.length < 3) return toast("Enter at least 3 characters of the VIN.", "error");
  if(!state.supabase) return toast("Connect Supabase first.", "error");
  const r = await state.supabase.from("vehicles").select("*").ilike("vin", `%${q}%`).limit(30);
  if(r.error) return toast(r.error.message, "error");
  await getLocations();
  const list = r.data || [];
  if(!list.length) return toast("No vehicle found for " + q, "error");
  input.value = "";
  if(list.length === 1) return openVehicleDetails(list[0]);
  openModal(`<div class="modal-bg" id="vdBg"><div class="modal wide" role="dialog" aria-modal="true"><div class="panel-head"><h3>${list.length} vehicles match “${esc(q)}”</h3><button class="icon-btn" type="button" id="modalClose">×</button></div>
    <div class="table-wrap">${table(["VIN No.","Model","Variant","Color","Status",""], list.map((v, i) => [raw(`<b class="mono">${esc(v.vin)}</b>`), v.model, v.variant, v.color, statusBadge(v.status), raw(`<button class="table-icon-btn" type="button" data-i="${i}">Details</button>`)]))}</div></div></div>`);
  $("modalClose").onclick = closeModal; $("vdBg").addEventListener("mousedown", ev => { if(ev.target.id === "vdBg") closeModal(); });
  document.querySelectorAll("#vdBg [data-i]").forEach(b => b.addEventListener("click", () => openVehicleDetails(list[+b.dataset.i])));
}
document.addEventListener("DOMContentLoaded", () => { $("globalSearch")?.addEventListener("submit", globalVinSearch); });

"use strict";
/* =====================================================================
   COMPUTED REPORTS: dashboard + reports are calculated straight from the
   `vehicles` table, so they always match imported data and never depend on
   database views that may be missing or filtered differently.
   ===================================================================== */
const VCACHE = {t:0, rows:null};
async function allVehicles(force = false){
  if(!force && VCACHE.rows && Date.now() - VCACHE.t < 15000) return VCACHE.rows;
  VCACHE.rows = await fetchAll(() => state.supabase.from("vehicles").select("*").order("id"), {max:50000});
  VCACHE.t = Date.now();
  return VCACHE.rows;
}
function vStage(v){
  const s = String(v.status || "").toLowerCase();
  if(s.includes("deliver")) return "delivered";
  if(s.includes("pending")) return "pending";
  if(s.includes("transit")) return "transit";
  if(s.includes("bill")) return "bill";
  return "stock";
}
const vValue = v => Number(v.stock_value || 0);
function groupStock(vehicles, keyOf){
  const g = new Map();
  vehicles.filter(v => vStage(v) !== "delivered").forEach(v => {
    const k = keyOf(v) || "Not Available";
    const x = g.get(k) || {key:k, stock_count:0, in_transit_count:0, pending_count:0, stock_value:0};
    const st = vStage(v);
    if(st === "pending") x.pending_count++; else { x[st === "transit" ? "in_transit_count" : "stock_count"]++; x.stock_value += vValue(v); }
    g.set(k, x);
  });
  return [...g.values()].map(x => ({...x, vehicle_count: x.stock_count + x.in_transit_count + x.pending_count}));
}
function agingBucket(d){ return d <= 30 ? "0-30 days" : d <= 60 ? "31-60 days" : d <= 90 ? "61-90 days" : "90+ days"; }
function daysSince(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); if(!m) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(+m[1], +m[2]-1, +m[3]).getTime()) / 86400000));
}

/* Aging population = Total Order Stock - Bill/Not Delivered - Delivered (so totals always tally with the dashboard cards) */
const AGING_BUCKETS = ["0-30 days","31-60 days","61-90 days","90+ days","No Date"];
function agingRows(all){
  return all.filter(v => { const st = vStage(v); return st !== "delivered" && st !== "bill"; }).map(v => {
    const dt = v.purchase_date ?? v.hmi_invoice_date ?? v.order_date;
    const d = daysSince(dt);
    return {vin:v.vin, model:v.model || "Not Available", variant:v.variant, color:v.color, order_no:v.order_no, status:v.status, purchase_date:dt,
      aging_days:d, aging_bucket: d === null ? "No Date" : agingBucket(d)};
  });
}
function modelAgeing(rows){
  const g = new Map();
  rows.forEach(r => {
    const x = g.get(r.model) || {model:r.model, vehicle_count:0, b0:0, b31:0, b61:0, b90:0, bnd:0};
    x.vehicle_count++;
    const k = {"0-30 days":"b0","31-60 days":"b31","61-90 days":"b61","90+ days":"b90"}[r.aging_bucket] || "bnd";
    x[k]++; g.set(r.model, x);
  });
  return [...g.values()];
}
async function gateRowsFallback(){
  const sb = state.supabase;
  let r = await sb.from("gate_movement_report").select("*").order("movement_time",{ascending:false}).limit(1000);
  if(!r.error) return r.data || [];
  r = await sb.from("gate_movements").select("*").order("created_at",{ascending:false}).limit(1000);
  if(r.error) r = await sb.from("gate_movements").select("*").limit(1000);
  if(r.error) return [];
  return (r.data || []).map(x => ({movement_time:x.movement_time || x.created_at || x.receipt_dt, movement_type:x.movement_type, vin:x.vin,
    from_location:x.from_location || "", to_location:x.to_location || "", gate_name:x.gate_name}));
}
async function computedRows(source){
  if(source === "gate_movement_report") return gateRowsFallback();
  const all = await allVehicles();
  await getLocations();
  switch(source){
    case "dashboard_stock_summary": {
      const c = {stock:0, pending:0, transit:0, bill:0, delivered:0}, val = {stock:0, pending:0, transit:0, bill:0, delivered:0};
      all.forEach(v => { const st = vStage(v); c[st]++; val[st] += vValue(v); });
      const sumVal = Object.values(val).reduce((a,b) => a + b, 0);
      return [{total_stock:all.length, available_stock:c.stock, in_transit:c.transit, pending_order:c.pending, bill_not_delivered:c.bill, delivered:c.delivered,
        total_value:sumVal, available_value:val.stock, transit_value:val.transit, pending_value:val.pending, bill_value:val.bill, delivered_value:val.delivered}];
    }
    case "location_stock_report":    return groupStock(all, v => v.location_id ? locName(v.location_id) : "Not Assigned").map(x => ({...x, location_name:x.key}));
    case "model_stock_report":       return groupStock(all, v => v.model).map(x => ({...x, model:x.key}));
    case "finance_stock_report":     return groupStock(all, v => v.finance_company || "Not Financed").map(x => ({...x, finance_company:x.key}));
    case "dealer_code_stock_report": return groupStock(all, v => v.dealer_code).map(x => ({...x, dealer_code:x.key}));
    case "aging_report":       return agingRows(all);
    case "model_ageing_report": return modelAgeing(agingRows(all));
    case "in_transit_report":    return all.filter(v => vStage(v) === "transit");
    case "pending_order_report": return all.filter(v => vStage(v) === "pending").map(v => ({order_no:v.order_no, order_date:v.order_date, model:v.model, variant:v.variant, quantity:1, expected_date:null, status:v.status, color:v.color, pis_no:v.pis_no}));
    case "delivery_report":      return all.filter(v => vStage(v) === "delivered").map(v => ({delivery_no:v.delivery_no || v.grn_no, delivery_date:v.delivery_date, vin:v.vin, model:v.model, customer_name:v.customer_name, finance_company:v.finance_company, location_name:v.location_id ? locName(v.location_id) : ""}));
    default: return all;
  }
}

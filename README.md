# Kothari Hyundai Vehicle Inventory (v2)

## Setup (once)
1. Supabase > SQL Editor > run `IMPORT_COLUMNS_FIX.sql` (adds every Excel column, removes import blockers). Safe to re-run.
2. Upload this folder (Netlify). Login: username + password.

## Import
- Order Report = SaleDealerOrderStatus.xlsx : Ordered/Allocated -> Pending Order, Invoiced -> In Transit.
- Purchase Report = VehicleDeliveryStatusReport.xlsx : -> In Transit; matches Order No, then VIN; Pending Order -> In Transit.
  In Stock / Delivered vehicles are never moved back. Files can be imported in any order and re-imported safely.
- Every Excel heading is stored (see js/fields.js). Dates are dd/mm/yyyy. Stock value: Purchase = HMI Invoice Amount, Order = Order Amount.
- Model names are unified to the HMI (Purchase) names, see MODEL_ALIASES in js/fields.js.

## Files
config.js, fields.js (Excel heading map), core.js, computed.js (dashboard/reports from vehicles), gate.js, inventory.js, import.js, admin.js.
Old monolithic script: _old/app.js.bak (not loaded).

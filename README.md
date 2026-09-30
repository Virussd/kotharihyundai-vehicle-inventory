# Kothari Hyundai Vehicle Inventory (v3)

## Setup (once)
1. Supabase > SQL Editor > run `IMPORT_COLUMNS_FIX.sql`, then **`SALES_IMPORT_COLUMNS.sql`**, **`RENAME_SALES_STATUS.sql`**, then **`NEW_FEATURES.sql`** (gate pass column, sales marker, "IN => Available Stock" rule). Both are safe to re-run.
2. Upload this folder (Netlify). Login: username + password.

## Stock flow
| Step | Result |
|---|---|
| Order report import (Ordered / Allocated) | **Pending Order** |
| Purchase report import (same Order No / VIN) | **In Transit** |
| Bhilarwadi / Branch **IN** (VIN in stock) | **Available Stock** at that location |
| Sales report import (VIN match with purchase data; columns: Bill Inv Date, Vin No, Engine no, Customer name, Bill No., TL, SC, Bill Location, Model, Variant, Colour, Total Bill Amount) | **Sales / Not Delivered** |
| Delivery Entry (VIN fetch: purchase + sales details auto, editable; delivery location; edit / delete) | **Delivered** |

Dashboard line: `Total Order Stock − Sales / Not Delivered − Delivered − Pending Order = vehicles (Available + In Transit)`.
Ageing (dashboard, Model wise table, Aging Report) covers **Available Stock only**.

## Users
Administration > Users & Roles: Role and Status are changed right in the list, ✎ edits, 🗑 deletes the user. Deploy the `delete-user` function once: `supabase functions deploy delete-user`.

## Screens
- Top bar: page heading on the left, **VIN search** beside it (opens vehicle details).
- Every list: `Showing 51–100 of 136  ‹ Prev  Page 2 / 3  Next ›` and a **Filter** button.
- Vehicle Management: Vehicle Stock, Search by VIN, Current Status, View Timeline, **Bhilarwadi Documents** (VIN search, photos, tyre serials, EV battery, download).
- Data Import: Order / Purchase / Sales import, **Imported Data** (filter + bulk delete), Import History.
- Gate: VIN **scan** (camera / photo of barcode), **gate pass photo upload**, vehicle IN details only on Bhilarwadi IN. No printing.
- Gate Pass: recent uploaded passes, VIN wise, with download.

## Files
config.js, fields.js, core.js, **ui.js** (paging, filter, scanner, VIN search), computed.js, gate.js, gate-bulk.js, gate-in.js, **docs.js** (documents + gate pass), inventory.js, import.js, admin.js, admin-tools.js.

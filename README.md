# Hyundai Vehicle Inventory System

## Live stack
- HTML / CSS / JavaScript
- Supabase JS
- Supabase PostgreSQL / Auth / RLS / Realtime
- GitHub
- Netlify

## Import mapping
- Order Report Import: `SaleDealerOrderStatus` Excel/CSV -> `vehicle_orders`
- Purchase Report Import: `VehicleDeliveryStatusReport` Excel/CSV -> `vehicles` (upsert by VIN)
- Import History -> `import_batches`

The importer previews Excel/CSV data in the browser, validates the expected columns, then writes to Supabase.

## Deployment
Push changes to GitHub. Netlify will automatically deploy the new commit when the repository is connected.


## Kothari Hyundai Final Login Design

- Login uses Username + Password only.
- Email is not shown or entered by users.
- Phone number and OTP/password-reset flow have been removed.
- Internal Supabase Auth email is generated from username and is never shown in the UI.
- Admin creates users from Administration -> Create Users & Roles.
- Roles: Admin, Accounts, Gate Operator, Viewer.
- The Supabase service-role key must remain server-side in the Edge Function and must never be placed in frontend files.

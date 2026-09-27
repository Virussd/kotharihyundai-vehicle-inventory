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

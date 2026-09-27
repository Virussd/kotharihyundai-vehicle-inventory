# Kothari Hyundai Vehicle Inventory - Updated Login

Changes in this package:
- Username + password login only.
- Removed Forgot Password / OTP reset UI and code.
- Only `admin2` is enabled in the frontend login mapping.
- `admin2` authenticates with `shubhamdamajighar6987@gmail.com` in Supabase Auth.
- Supabase project URL and publishable key are included in `js/config.js`.
- No service-role key is included.

Admin profile expected in Supabase:
- UID: 360fc0dd-28d5-47d9-935a-feab36a48624
- Username: admin2
- Role: Admin
- Location: NULL (all locations)
- Active: true

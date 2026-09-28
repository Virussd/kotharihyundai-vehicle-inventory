IMPORTANT FILES
1. js/app.js       = main application logic
2. js/config.js    = Supabase URL + publishable key
3. index.html      = page structure
4. css/styles.css  = layout/style
5. ADMIN_FEATURES.sql = run once in Supabase SQL Editor
6. supabase/functions/create-user/index.ts = Admin-only user creation function

After SQL:
supabase functions deploy create-user

Do not put SUPABASE_SERVICE_ROLE_KEY in frontend files.

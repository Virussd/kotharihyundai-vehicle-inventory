-- Kothari Hyundai: Settings that save, Data Management (delete / reset) and Admin edit rights. Safe to re-run.

-- 1. Extra company fields used by the Company settings page and the Gate Pass header
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS gate_pass_note text;
INSERT INTO public.company_settings (id, company_name) VALUES (1, 'Kothari Hyundai') ON CONFLICT (id) DO NOTHING;

-- 2. Default system settings (ageing buckets, page size, dashboard rows, import rules)
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
 ('age_limit_1','30','Ageing bucket 1 up to (days)'),
 ('age_limit_2','60','Ageing bucket 2 up to (days)'),
 ('age_limit_3','90','Ageing bucket 3 up to (days)'),
 ('vehicle_page_size','50','Vehicle Stock rows per page'),
 ('dashboard_recent_rows','8','Dashboard recent movements shown'),
 ('imp_order_invoiced_to_transit','true','Order import: Invoiced rows go to In Transit'),
 ('imp_purchase_moves_pending','true','Purchase import: Pending Order moves to In Transit')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Everybody signed in can READ settings (needed for company name, ageing, page size); only Admin can change them
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_settings','system_settings','import_configuration'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_read_' || t, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'authenticated_read_' || t, t);
    END IF;
  END LOOP;
END $$;

-- 4. Admin can add / edit / delete on every business table (edit vehicles, locations, roles, deliveries, gate, imports, reset)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','locations','gate_movements','deliveries','import_batches','vehicle_timeline','audit_logs',
                           'company_settings','system_settings','import_configuration','roles','user_profiles'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_full_access_' || t, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', 'admin_full_access_' || t, t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

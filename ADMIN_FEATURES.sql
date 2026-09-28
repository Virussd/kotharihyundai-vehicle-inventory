RESET ROLE;

-- Admin/Settings support tables
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id, permission_id)
);

INSERT INTO public.permissions(code,name,description) VALUES
('dashboard.view','Dashboard','View dashboard'),
('vehicle.view','Vehicle Stock','View vehicle stock'),
('vehicle.update','Vehicle Update','Update vehicle records'),
('import.order','Order Import','Import order reports'),
('import.purchase','Purchase Import','Import purchase reports'),
('import.sales','Sales Import','Import sales reports'),
('gate.inout','Vehicle In/Out','Manage gate movements'),
('gate.pass','Gate Pass','Manage gate passes'),
('delivery.manage','Delivery','Manage deliveries'),
('reports.view','Reports','View all reports'),
('users.manage','Users','Create and manage users'),
('permissions.manage','Permissions','Manage permissions'),
('settings.manage','Settings','Manage system settings')
ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description;

CREATE TABLE IF NOT EXISTS public.company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text,
  brand text,
  gstin text,
  address text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text UNIQUE NOT NULL,
  target_table text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.import_configuration(import_type,target_table) VALUES
('ORDER','orders'),('PURCHASE','vehicles'),('SALES','sales')
ON CONFLICT(import_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings(setting_key,setting_value,description) VALUES
('system_name','Kothari Hyundai Vehicle Inventory','Application name'),
('currency','INR','Display currency'),
('date_format','DD-MM-YYYY','Display date format')
ON CONFLICT(setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_username text,
  action text NOT NULL,
  module text,
  entity_type text,
  entity_id text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_admin_all ON public.permissions;
CREATE POLICY permissions_admin_all ON public.permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS role_permissions_admin_all ON public.role_permissions;
CREATE POLICY role_permissions_admin_all ON public.role_permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS company_settings_admin_all ON public.company_settings;
CREATE POLICY company_settings_admin_all ON public.company_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS import_configuration_admin_all ON public.import_configuration;
CREATE POLICY import_configuration_admin_all ON public.import_configuration FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS system_settings_admin_all ON public.system_settings;
CREATE POLICY system_settings_admin_all ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

GRANT SELECT ON public.permissions, public.role_permissions, public.company_settings, public.import_configuration, public.system_settings, public.audit_logs TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.role_permissions, public.company_settings, public.import_configuration, public.system_settings TO authenticated;

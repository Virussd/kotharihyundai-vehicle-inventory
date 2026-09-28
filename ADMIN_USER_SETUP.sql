RESET ROLE;

-- User-specific permissions
CREATE TABLE IF NOT EXISTS public.app_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code text NOT NULL UNIQUE,
  permission_name text NOT NULL,
  module text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.app_permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

INSERT INTO public.app_permissions(permission_code,permission_name,module,description) VALUES
('dashboard.view','Dashboard','Dashboard','View dashboard'),
('vehicle.view','Vehicle Stock','Vehicle Management','View vehicle stock'),
('vehicle.create','Create Vehicle','Vehicle Management','Create vehicle records'),
('vehicle.update','Update Vehicle','Vehicle Management','Update vehicle records'),
('import.order','Order Import','Data Import','Import order reports'),
('import.purchase','Purchase Import','Data Import','Import purchase reports'),
('import.sales','Sales Import','Data Import','Import sales reports'),
('gate.inout','Vehicle In/Out','Gate Management','Record vehicle movement'),
('gate.pass','Gate Pass','Gate Management','Create/print gate pass'),
('gate.register','In-Out Register','Gate Management','View gate register'),
('delivery.manage','Delivery','Delivery','Manage vehicle delivery'),
('report.all','All Reports','Reports','View all reports'),
('report.finance','Finance Reports','Reports','View finance reports'),
('report.inventory','Inventory Reports','Reports','View inventory reports'),
('admin.users','Users','Administration','Create and manage users'),
('admin.permissions','Permissions','Administration','Assign permissions to users'),
('admin.user_status','User Status','Administration','Activate/deactivate users'),
('admin.audit','Audit Logs','Administration','View audit logs'),
('settings.manage','Settings','Settings','Manage system settings')
ON CONFLICT(permission_code) DO UPDATE SET
  permission_name=EXCLUDED.permission_name,
  module=EXCLUDED.module,
  description=EXCLUDED.description,
  active=true;

ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_admin_all" ON public.app_permissions;
CREATE POLICY "permissions_admin_all" ON public.app_permissions FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_permissions_admin_all" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_all" ON public.user_permissions FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT ON public.locations TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Ensure the current administrator remains correct.
UPDATE public.user_profiles
SET username='admin', full_name='Administrator', location_id=NULL, active=true,
    role_id=(SELECT id FROM public.roles WHERE name='Admin' LIMIT 1), updated_at=now()
WHERE id='360fc0dd-28d5-47d9-935a-feab36a48624';

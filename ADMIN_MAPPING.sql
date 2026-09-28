RESET ROLE;

-- ============================================================
-- KOTHARI HYUNDAI - ADMIN + USER PERMISSION SETUP
-- ============================================================

-- 1) Final Admin profile
INSERT INTO public.user_profiles
(
    id, username, full_name, role_id, location_id, active
)
SELECT
    '360fc0dd-28d5-47d9-935a-feab36a48624'::uuid,
    'admin',
    'Administrator',
    r.id,
    NULL,
    true
FROM public.roles r
WHERE r.name = 'Admin'
ON CONFLICT (id) DO UPDATE SET
    username = 'admin',
    full_name = 'Administrator',
    role_id = EXCLUDED.role_id,
    location_id = NULL,
    active = true,
    updated_at = now();

-- 2) Permission catalogue used by the Admin > Permissions screen
CREATE TABLE IF NOT EXISTS public.app_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_permissions(code,name) VALUES
('dashboard.view','Dashboard'),
('vehicle.view','Vehicle Stock / View'),
('vehicle.create','Vehicle Stock / Create'),
('vehicle.update','Vehicle Stock / Update'),
('vehicle.search','Search by Chassis / VIN'),
('import.order','Order Report Import'),
('import.purchase','Purchase Report Import'),
('import.sales','Sales Report Import'),
('import.history','Import History'),
('gate.inout','Vehicle In / Out'),
('gate.pass','Gate Pass'),
('gate.register','In-Out Register'),
('delivery.entry','Delivery Entry'),
('delivery.view','Delivered Vehicles / History'),
('report.location','Location Stock Report'),
('report.model','Model Stock Report'),
('report.finance','Finance-wise Stock Report'),
('report.aging','Aging Report'),
('report.delivery','Delivery Report'),
('report.pending','Pending Order Report'),
('report.transit','In Transit Report'),
('report.gate','Gate Movement Report'),
('report.dealer','Dealer Code-wise Stock'),
('admin.users','Create Users'),
('admin.permissions','Manage Permissions'),
('admin.status','Manage User Status'),
('admin.audit','View Audit Logs')
ON CONFLICT(code) DO UPDATE SET
    name = EXCLUDED.name,
    active = true;

-- 3) User-specific permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES public.app_permissions(id) ON DELETE CASCADE,
    allowed boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, permission_id)
);

-- 4) Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    module text NOT NULL,
    details text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_permissions_admin_all" ON public.app_permissions;
CREATE POLICY "app_permissions_admin_all"
ON public.app_permissions FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_permissions_admin_all" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_all"
ON public.user_permissions FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_logs_admin_all" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_admin_all"
ON public.admin_audit_logs FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_logs TO authenticated;

-- 5) Verification
SELECT
    au.id AS auth_uid,
    au.email AS auth_email,
    up.username,
    up.full_name,
    r.name AS role,
    up.location_id,
    up.active
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
LEFT JOIN public.roles r ON r.id = up.role_id
WHERE au.email = 'shubhamdamajighar6987@gmail.com';

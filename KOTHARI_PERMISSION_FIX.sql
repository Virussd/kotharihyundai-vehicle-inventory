-- KOTHARI HYUNDAI - FINAL DATABASE PERMISSION FIX
-- Run this whole script in Supabase SQL Editor.
-- Safe for missing report/view objects: it only grants on objects that exist.

RESET ROLE;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ---------------------------------------------------------
-- 1. Read access to existing public tables/views
-- ---------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p','v','m')
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- 2. Required write access for the application
-- RLS policies below still control protected tables.
-- ---------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p')
      AND c.relname IN (
        'vehicles',
        'gate_movements',
        'deliveries',
        'import_batches',
        'user_profiles',
        'roles',
        'permissions',
        'role_permissions',
        'app_permissions',
        'user_permissions',
        'audit_logs',
        'admin_audit_logs',
        'company_settings',
        'import_configuration',
        'system_settings'
      )
  LOOP
    EXECUTE format(
      'GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      r.relname
    );
    EXECUTE format(
      'GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
      r.relname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- 3. Sequence permissions for inserts
-- ---------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------
-- 4. Admin = full access on existing tables that use RLS
-- This fixes "permission denied" for the Admin account while
-- leaving non-admin access controlled by their existing policies.
-- ---------------------------------------------------------
DO $$
DECLARE
  r record;
  policy_name text;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p')
      AND c.relrowsecurity = true
      AND c.relname IN (
        'vehicles',
        'locations',
        'gate_movements',
        'deliveries',
        'import_batches',
        'user_profiles',
        'roles',
        'permissions',
        'role_permissions',
        'app_permissions',
        'user_permissions',
        'audit_logs',
        'admin_audit_logs',
        'company_settings',
        'import_configuration',
        'system_settings',
        'vehicle_timeline'
      )
  LOOP
    policy_name := 'admin_full_access_' || r.relname;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_name, r.relname
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
       FOR ALL TO authenticated
       USING (public.is_admin())
       WITH CHECK (public.is_admin())',
      policy_name, r.relname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- 5. Authenticated read access for inventory/report data
-- Needed by Dashboard, Viewer and Accounts screens when RLS
-- is enabled on these operational tables.
-- ---------------------------------------------------------
DO $$
DECLARE
  r record;
  policy_name text;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p')
      AND c.relrowsecurity = true
      AND c.relname IN (
        'vehicles',
        'locations',
        'gate_movements',
        'deliveries',
        'vehicle_timeline',
        'import_batches'
      )
  LOOP
    policy_name := 'authenticated_read_' || r.relname;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_name, r.relname
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
       FOR SELECT TO authenticated
       USING (true)',
      policy_name, r.relname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- 6. Admin verification RPC
-- Used by create-user Edge Function.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path=public
SET row_security=off
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_profiles up
    JOIN public.roles r ON r.id=up.role_id
    WHERE up.id=p_user_id
      AND up.active=true
      AND lower(trim(r.name))='admin'
  );
$$;

ALTER FUNCTION public.verify_admin_user(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.verify_admin_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_user(uuid) TO service_role;

-- ---------------------------------------------------------
-- 7. Show current Admin profile for verification
-- ---------------------------------------------------------
SELECT
  up.id,
  up.username,
  up.full_name,
  r.name AS role,
  up.location_id,
  up.active
FROM public.user_profiles up
LEFT JOIN public.roles r ON r.id=up.role_id
WHERE lower(up.username)='admin';

-- =====================================================================
-- KOTHARI HYUNDAI - IMPORT COLUMNS FIX  (run ONCE in Supabase > SQL Editor)
-- Safe to run again: every step is "if not exists" / only-if-needed.
-- Adds every column of SaleDealerOrderStatus.xlsx and VehicleDeliveryStatusReport.xlsx
-- to public.vehicles, removes blockers (NOT NULL / status check) so imports never fail.
-- =====================================================================
RESET ROLE;

-- 1. vehicles table (only created if it does not exist)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- 2. Excel columns
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('order_date','date'),
    ('order_no','text'),
    ('pis_no','text'),
    ('model','text'),
    ('variant','text'),
    ('color','text'),
    ('order_amount','numeric(14,2)'),
    ('order_type','text'),
    ('assigned_date','date'),
    ('confirm_date','date'),
    ('vin','text'),
    ('order_status','text'),
    ('customer_id','text'),
    ('customer_name','text'),
    ('main_dealer','text'),
    ('dealer_code','text'),
    ('hmi_invoice_date','date'),
    ('hmi_invoice_no','text'),
    ('excise_invoice_no','text'),
    ('fsc','text'),
    ('variant_code','text'),
    ('engine_no','text'),
    ('finance_company','text'),
    ('departure_date','date'),
    ('lot_number','text'),
    ('transporter_name','text'),
    ('transporter_vehicle_no','text'),
    ('basic_price','numeric(14,2)'),
    ('freight_insurance','numeric(14,2)'),
    ('total_invoice_value','numeric(14,2)'),
    ('igst_pct','numeric'),
    ('igst','numeric(14,2)'),
    ('cgst_pct','numeric'),
    ('cgst','numeric(14,2)'),
    ('sgst_pct','numeric'),
    ('sgst','numeric(14,2)'),
    ('comp_cess_pct','numeric'),
    ('comp_cess','numeric(14,2)'),
    ('tcs_pct','numeric'),
    ('tcs_value','numeric(14,2)'),
    ('hmi_invoice_amount','numeric(14,2)'),
    ('hsn_code','text'),
    ('emission_type','text'),
    ('quantity','numeric'),
    ('grn_no','text'),
    ('grn_date','date'),
    ('sale_tax','numeric(14,2)'),
    ('fob_key','text'),
    ('chassis_no','text'),
    ('stock_value','numeric(14,2)'),
    ('purchase_date','date'),
    ('status','text'),
    ('chassis_no','text'),
    ('stock_value','numeric(14,2)'),
    ('purchase_date','date'),
    ('status','text'),
    ('remarks','text'),
    ('vehicle_no','text'),
    ('delivery_date','date')
  ) AS t(name, typ) LOOP
    EXECUTE format('ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS %I %s', c.name, c.typ);
  END LOOP;
END $$;

-- 3. Pending orders have no VIN yet, so no column may be NOT NULL (except id / defaults)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vehicles' AND is_nullable='NO'
      AND column_default IS NULL AND is_identity='NO' AND is_generated='NEVER' AND column_name <> 'id'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicles ALTER COLUMN %I DROP NOT NULL', c.column_name);
  END LOOP;
END $$;

-- 4. Status: allow 'Pending Order', 'In Transit', 'In Stock', 'Delivered'
DO $$
DECLARE t text; v text; r record;
BEGIN
  SELECT udt_name INTO t FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vehicles' AND column_name='status' AND data_type='USER-DEFINED';
  IF t IS NOT NULL THEN
    FOREACH v IN ARRAY ARRAY['Pending Order','In Transit','In Stock','Delivered'] LOOP
      BEGIN EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, v);
      EXCEPTION WHEN others THEN NULL; END;
    END LOOP;
  END IF;
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid='public.vehicles'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 5. Import history table
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS import_type text;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS total_rows integer;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS successful_rows integer;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS failed_rows integer;
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS status text;

-- 6. Permissions (Admin + Accounts may import; everyone signed-in may read)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles, public.import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles, public.import_batches TO service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
             AND c.relname IN ('vehicles','import_batches')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'import_read_'||r.relname, r.relname);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'import_read_'||r.relname, r.relname);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'import_write_'||r.relname, r.relname);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles ro ON ro.id=up.role_id
                     WHERE up.id=auth.uid() AND up.active IS NOT FALSE AND lower(trim(ro.name)) IN ('admin','accounts')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles ro ON ro.id=up.role_id
                     WHERE up.id=auth.uid() AND up.active IS NOT FALSE AND lower(trim(ro.name)) IN ('admin','accounts')))$p$,
      'import_write_'||r.relname, r.relname);
  END LOOP;
END $$;

-- 7. Helpful lookup indexes (not unique, so they can never fail on old data)
CREATE INDEX IF NOT EXISTS vehicles_vin_idx ON public.vehicles (vin);
CREATE INDEX IF NOT EXISTS vehicles_order_no_idx ON public.vehicles (order_no);

-- 8. Refresh the API schema cache so new columns work immediately
NOTIFY pgrst, 'reload schema';

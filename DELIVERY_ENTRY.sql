-- Kothari Hyundai: Delivery Entry columns. Run ONCE in Supabase > SQL Editor (after SALES_IMPORT_COLUMNS.sql). Safe to re-run.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS delivery_no text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS delivery_location text;

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_location text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS engine_no text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS variant text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS bill_no text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS team_leader text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS executive text;
-- Delivery No is no longer typed in the form: make sure the old column does not block saving
DO $$ BEGIN ALTER TABLE public.deliveries ALTER COLUMN delivery_no DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;
NOTIFY pgrst, 'reload schema';

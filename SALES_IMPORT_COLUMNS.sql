-- Kothari Hyundai: Sales report import columns. Run ONCE in Supabase > SQL Editor. Safe to re-run.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS bill_date date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS bill_no text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS team_leader text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS executive text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS sales_location text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS bill_amount numeric(14,2);
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS sales_imported_at timestamptz;
NOTIFY pgrst, 'reload schema';

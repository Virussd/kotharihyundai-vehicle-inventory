-- Bhilarwadi In / Out - Purchase Report auto-fill support
RESET ROLE;

-- Vehicle number is optional in old databases; add it for Purchase Report data.
ALTER TABLE IF EXISTS public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_no text;

ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS receipt_dt date;

ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS remarks text;

GRANT SELECT ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gate_movements TO authenticated;

-- Branch/Bhilarwadi gate: manual vehicle details + Purchase Report VIN suggestions
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS vehicle_no text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS vin text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS engine_no text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS variant text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS finance_bank text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS gate_name text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE IF EXISTS public.gate_movements
  ADD COLUMN IF NOT EXISTS driver_mobile text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate_movements TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gate_movements' AND column_name='vehicle_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.gate_movements ALTER COLUMN vehicle_id DROP NOT NULL';
  END IF;
END $$;

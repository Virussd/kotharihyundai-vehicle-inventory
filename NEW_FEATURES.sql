-- Kothari Hyundai v3: run ONCE in Supabase > SQL Editor. Safe to re-run.

-- 1. Gate pass photo saved with each Bhilarwadi / Branch In-Out entry
ALTER TABLE public.gate_movements ADD COLUMN IF NOT EXISTS gate_pass_file text;

-- 2. Marks vehicles that came from the Sales report import (Imported Data window)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS sales_imported_at timestamptz;

-- 3. Make sure the Bhilarwadi location exists (so vehicles received there show in Location wise stock)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE lower(location_name) = 'bhilarwadi') THEN
    INSERT INTO public.locations (location_name, active) VALUES ('Bhilarwadi', true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Bhilarwadi location not created automatically (%). Add it in Settings > Locations.', SQLERRM;
END $$;

-- 4. Vehicle IN (Bhilarwadi or Branch) => Available Stock ("In Stock") at that location.
--    Runs inside the database so it works for every role (gate operators cannot edit vehicles directly).
--    Sales / Not Delivered and Delivered vehicles are never moved back.
CREATE OR REPLACE FUNCTION public.gate_in_makes_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE loc uuid;
BEGIN
  IF NEW.vehicle_id IS NULL OR upper(coalesce(NEW.movement_type, '')) <> 'IN' THEN RETURN NEW; END IF;
  SELECT id INTO loc FROM public.locations WHERE lower(location_name) = lower(coalesce(NEW.location_name, '')) LIMIT 1;
  UPDATE public.vehicles v
     SET status = 'In Stock', location_id = COALESCE(loc, v.location_id)
   WHERE v.id = NEW.vehicle_id
     AND lower(coalesce(v.status, '')) NOT LIKE '%deliver%'
     AND lower(coalesce(v.status, '')) NOT LIKE '%bill%';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gate_in_makes_stock ON public.gate_movements;
CREATE TRIGGER trg_gate_in_makes_stock AFTER INSERT ON public.gate_movements
  FOR EACH ROW EXECUTE FUNCTION public.gate_in_makes_stock();

NOTIFY pgrst, 'reload schema';

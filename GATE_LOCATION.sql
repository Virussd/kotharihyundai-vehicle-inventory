-- Gate In/Out: Location column. Safe to re-run.
ALTER TABLE public.gate_movements ADD COLUMN IF NOT EXISTS location_name text;

-- Old Bhilarwadi entries get the Bhilarwadi location.
UPDATE public.gate_movements SET location_name = 'Bhilarwadi'
WHERE location_name IS NULL AND gate_name = 'Bhilarwadi';

NOTIFY pgrst, 'reload schema';

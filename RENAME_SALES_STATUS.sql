-- Kothari Hyundai: status "Bill / Not Delivered" renamed to "Sales / Not Delivered".
-- Run ONCE in Supabase > SQL Editor (updates vehicles already imported). Safe to re-run.
UPDATE public.vehicles SET status = 'Sales / Not Delivered'
 WHERE status ILIKE 'bill%not%deliver%';
NOTIFY pgrst, 'reload schema';

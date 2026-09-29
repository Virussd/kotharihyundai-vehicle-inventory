-- Bhilarwadi Vehicle IN details: 6 photos (private storage bucket) + 4 tyre serials + EV battery. Safe to re-run.
ALTER TABLE public.gate_movements
  ADD COLUMN IF NOT EXISTS photo_front text,
  ADD COLUMN IF NOT EXISTS photo_chassis_no text,
  ADD COLUMN IF NOT EXISTS photo_chassis_plate text,
  ADD COLUMN IF NOT EXISTS photo_form22 text,
  ADD COLUMN IF NOT EXISTS photo_cng_cert text,
  ADD COLUMN IF NOT EXISTS photo_cng_kit text,
  ADD COLUMN IF NOT EXISTS tyre_serial_1 text,
  ADD COLUMN IF NOT EXISTS tyre_serial_2 text,
  ADD COLUMN IF NOT EXISTS tyre_serial_3 text,
  ADD COLUMN IF NOT EXISTS tyre_serial_4 text,
  ADD COLUMN IF NOT EXISTS ev_battery_no text;

-- Private bucket, images only, 5 MB each
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gate-photos', 'gate-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS gate_photos_select ON storage.objects;
CREATE POLICY gate_photos_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'gate-photos');

DROP POLICY IF EXISTS gate_photos_insert ON storage.objects;
CREATE POLICY gate_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gate-photos');

-- UPDATE is needed because uploads use upsert (a retry overwrites the same file)
DROP POLICY IF EXISTS gate_photos_update ON storage.objects;
CREATE POLICY gate_photos_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'gate-photos') WITH CHECK (bucket_id = 'gate-photos');

DROP POLICY IF EXISTS gate_photos_admin_delete ON storage.objects;
CREATE POLICY gate_photos_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gate-photos' AND EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid() AND lower(r.name) = 'admin'));

NOTIFY pgrst, 'reload schema';

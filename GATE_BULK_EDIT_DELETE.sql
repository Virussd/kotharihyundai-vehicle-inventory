-- Gate In/Out: bulk save + edit / delete (Admin). Safe to re-run.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate_movements TO authenticated;

DROP POLICY IF EXISTS gate_movements_admin_update ON public.gate_movements;
CREATE POLICY gate_movements_admin_update ON public.gate_movements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid() AND lower(r.name) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid() AND lower(r.name) = 'admin'));

DROP POLICY IF EXISTS gate_movements_admin_delete ON public.gate_movements;
CREATE POLICY gate_movements_admin_delete ON public.gate_movements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles up JOIN public.roles r ON r.id = up.role_id WHERE up.id = auth.uid() AND lower(r.name) = 'admin'));

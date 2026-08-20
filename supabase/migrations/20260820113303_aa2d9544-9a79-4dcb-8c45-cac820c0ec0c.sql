
-- Habilitar a política de exclusão para donos
DROP POLICY IF EXISTS "Owners can delete servers" ON public.servers;
CREATE POLICY "Owners can delete servers" ON public.servers 
FOR DELETE TO authenticated 
USING (owner_id = auth.uid());

-- Garantir GRANTs para a role authenticated
GRANT DELETE ON public.servers TO authenticated;

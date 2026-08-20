-- Leitura de servidores onde o usuário é membro
DROP POLICY IF EXISTS "Users can read servers they belong to" ON public.servers;
CREATE POLICY "Users can read servers they belong to" 
ON public.servers FOR SELECT TO authenticated 
USING (
  owner_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.members WHERE server_id = servers.id AND user_id = auth.uid())
);

-- Leitura de membros
DROP POLICY IF EXISTS "Members can view members" ON public.members;
CREATE POLICY "Members can view members" 
ON public.members FOR SELECT TO authenticated USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT ON public.servers TO authenticated;
GRANT SELECT ON public.members TO authenticated;
GRANT ALL ON public.servers TO service_role;
GRANT ALL ON public.members TO service_role;

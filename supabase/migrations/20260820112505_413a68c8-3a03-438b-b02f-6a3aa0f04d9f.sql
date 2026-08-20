-- Desabilitar temporariamente para resetar
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 1. POLICIES PARA SERVERS (SEM RECURSÃO)
DROP POLICY IF EXISTS "Users can read servers they belong to" ON public.servers;
DROP POLICY IF EXISTS "Users can view servers" ON public.servers;
DROP POLICY IF EXISTS "Users can create servers" ON public.servers;

CREATE POLICY "Authenticated users can select servers" ON public.servers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create servers" ON public.servers
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- 2. POLICIES PARA MEMBERS (SEM AUTO-CONSULTA RECURSIVA)
DROP POLICY IF EXISTS "Members can view members" ON public.members;
DROP POLICY IF EXISTS "Users can insert members" ON public.members;

-- Permitir que usuários autenticados leiam a lista de membros diretamente
CREATE POLICY "Authenticated users can view members" ON public.members
FOR SELECT TO authenticated USING (true);

-- Permitir que o próprio usuário entre no servidor ou seja adicionado pelo criador
CREATE POLICY "Users can insert membership" ON public.members
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
);

-- 3. POLICIES PARA CHANNELS
DROP POLICY IF EXISTS "Members can view channels" ON public.channels;
DROP POLICY IF EXISTS "Owners can insert channels" ON public.channels;

CREATE POLICY "Authenticated users can view channels" ON public.channels
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Server owners can create channels" ON public.channels
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
);

-- 4. POLICIES PARA MESSAGES
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can insert messages" ON public.messages;

CREATE POLICY "Authenticated users can read messages" ON public.messages
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can send messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Granting access as required
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

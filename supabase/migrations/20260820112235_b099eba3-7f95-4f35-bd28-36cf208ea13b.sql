-- Habilitar RLS em todas as tabelas
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- GRANTS (Necessário no Supabase para acesso via Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

GRANT ALL ON public.servers TO service_role;
GRANT ALL ON public.members TO service_role;
GRANT ALL ON public.channels TO service_role;
GRANT ALL ON public.messages TO service_role;

-- POLICIES: SERVERS
DROP POLICY IF EXISTS "Users can create servers" ON public.servers;
CREATE POLICY "Users can create servers" 
ON public.servers FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Members can view servers" ON public.servers;
CREATE POLICY "Members can view servers" 
ON public.servers FOR SELECT TO authenticated 
USING (
  owner_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.members WHERE server_id = id AND user_id = auth.uid())
);

-- POLICIES: MEMBERS
DROP POLICY IF EXISTS "Users can join servers" ON public.members;
CREATE POLICY "Users can join servers" 
ON public.members FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can view other members" ON public.members;
CREATE POLICY "Members can view other members" 
ON public.members FOR SELECT TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.members m2 WHERE m2.server_id = server_id AND m2.user_id = auth.uid())
);

-- POLICIES: CHANNELS
DROP POLICY IF EXISTS "Members can view channels" ON public.channels;
CREATE POLICY "Members can view channels" 
ON public.channels FOR SELECT TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.members WHERE server_id = channels.server_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners can create channels" ON public.channels;
CREATE POLICY "Owners can create channels" 
ON public.channels FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
);

-- POLICIES: MESSAGES
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" 
ON public.messages FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.members m ON m.server_id = c.server_id
    WHERE c.id = channel_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" 
ON public.messages FOR INSERT TO authenticated 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.members m ON m.server_id = c.server_id
    WHERE c.id = channel_id AND m.user_id = auth.uid()
  )
);

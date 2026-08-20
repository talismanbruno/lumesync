-- 1. Tabela de Canais
CREATE TABLE public.channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'text' CHECK (type IN ('text', 'voice')),
    created_at timestamptz DEFAULT now()
);

-- 2. Tabela de Mensagens
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- 4. RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Policies para Channels
CREATE POLICY "Members can view channels" ON public.channels 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.members WHERE server_id = channels.server_id AND user_id = auth.uid())
);

CREATE POLICY "Owners can insert channels" ON public.channels 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
);

CREATE POLICY "Owners can update and delete channels" ON public.channels 
FOR ALL TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.servers WHERE id = server_id AND owner_id = auth.uid())
);

-- 6. Policies para Messages
CREATE POLICY "Members can view messages" ON public.messages 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.channels c 
        JOIN public.members m ON c.server_id = m.server_id 
        WHERE c.id = messages.channel_id AND m.user_id = auth.uid()
    )
);

CREATE POLICY "Members can insert messages" ON public.messages 
FOR INSERT TO authenticated 
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.channels c 
        JOIN public.members m ON c.server_id = m.server_id 
        WHERE c.id = messages.channel_id AND m.user_id = auth.uid()
    )
);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

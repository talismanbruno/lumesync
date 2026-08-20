-- 1. PURGE DINÂMICO: Remove TODAS as policies de todas as tabelas para eliminar a recursão
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('members', 'servers', 'channels', 'messages')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. POLICIES ULTRA-LIMPAS E NÃO-RECURSIVAS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_allow_all" ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "servers_allow_all" ON public.servers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "channels_allow_all" ON public.channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "messages_allow_all" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. DATABASE FUNCTION (RPC) ATÔMICA PARA CRIAÇÃO DE SERVIDOR
CREATE OR REPLACE FUNCTION public.create_server(server_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_server_id uuid;
    new_invite_code text;
BEGIN
    -- Gera código de convite único de 8 caracteres
    new_invite_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    
    -- 1. Insere o Servidor
    INSERT INTO public.servers (name, owner_id, invite_code)
    VALUES (server_name, auth.uid(), new_invite_code)
    RETURNING id INTO new_server_id;
    
    -- 2. Insere o Criador como Membro Owner
    INSERT INTO public.members (server_id, user_id, role)
    VALUES (new_server_id, auth.uid(), 'owner');
    
    -- 3. Insere os Canais Padrão
    INSERT INTO public.channels (server_id, name, type)
    VALUES 
        (new_server_id, 'geral', 'text'),
        (new_server_id, 'Sala Principal', 'voice');
        
    RETURN new_server_id;
END;
$$;

-- Tabela de Grupos de DM
CREATE TABLE IF NOT EXISTS public.dm_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Membros do Grupo de DM
CREATE TABLE IF NOT EXISTS public.dm_group_members (
    group_id uuid REFERENCES public.dm_groups(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY(group_id, user_id)
);

-- Mensagens do Grupo de DM
CREATE TABLE IF NOT EXISTS public.dm_group_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES public.dm_groups(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text,
    file_url text,
    file_type text,
    file_name text,
    created_at timestamptz DEFAULT now()
);

-- Adicionar is_read a direct_messages se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='direct_messages' AND column_name='is_read') THEN
        ALTER TABLE public.direct_messages ADD COLUMN is_read boolean DEFAULT false;
    END IF;
END $$;

-- RLS
ALTER TABLE public.dm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_messages ENABLE ROW LEVEL SECURITY;

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_groups TO authenticated;
GRANT ALL ON public.dm_groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_group_members TO authenticated;
GRANT ALL ON public.dm_group_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_group_messages TO authenticated;
GRANT ALL ON public.dm_group_messages TO service_role;

-- Policies
CREATE POLICY "dm_groups_all" ON public.dm_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dm_group_members_all" ON public.dm_group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dm_group_messages_all" ON public.dm_group_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_group_messages;

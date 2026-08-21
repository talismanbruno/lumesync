-- 1. Garantir tabelas de grupos de DM
CREATE TABLE IF NOT EXISTS public.dm_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dm_group_members (
    group_id uuid REFERENCES public.dm_groups(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY(group_id, user_id)
);

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

ALTER TABLE public.dm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_groups_open" ON public.dm_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dm_group_members_open" ON public.dm_group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dm_group_messages_open" ON public.dm_group_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_group_messages;

-- 2. FUNÇÃO ATÔMICA DE CRIAÇÃO DE GRUPO (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_dm_group(group_name text, member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
    new_group_id uuid;
    mid uuid;
BEGIN
    -- Cria o grupo
    INSERT INTO public.dm_groups (name, created_by)
    VALUES (group_name, auth.uid())
    RETURNING id INTO new_group_id;
    
    -- Adiciona o criador
    INSERT INTO public.dm_group_members (group_id, user_id)
    VALUES (new_group_id, auth.uid());
    
    -- Adiciona os amigos selecionados
    FOREACH mid IN ARRAY member_ids LOOP
        IF mid != auth.uid() THEN
            INSERT INTO public.dm_group_members (group_id, user_id)
            VALUES (new_group_id, mid)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    RETURN new_group_id;
END;
\$\$;

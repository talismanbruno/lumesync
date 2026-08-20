
-- Tabela de Amizades
CREATE TABLE IF NOT EXISTS public.friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    addressee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(requester_id, addressee_id)
);

-- Tabela de Mensagens Diretas (1:1)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.friendships TO authenticated;
GRANT ALL ON public.direct_messages TO authenticated;
GRANT ALL ON public.friendships TO service_role;
GRANT ALL ON public.direct_messages TO service_role;

-- Policies
CREATE POLICY "friendships_all" ON public.friendships FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "direct_messages_all" ON public.direct_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ativar Realtime (note: publication might already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friendships') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;

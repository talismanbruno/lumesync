CREATE TABLE IF NOT EXISTS public.voice_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at timestamptz DEFAULT now(),
    UNIQUE(channel_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_participants TO authenticated;
GRANT ALL ON public.voice_participants TO service_role;

ALTER TABLE public.voice_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_participants_all" ON public.voice_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Check if table is already in publication to avoid errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'voice_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_participants;
  END IF;
END $$;
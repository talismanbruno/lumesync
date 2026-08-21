
-- 1. Garantir colunas de anexo na tabela messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name text;

-- 2. Garantir colunas de anexo na tabela direct_messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- 3. Políticas de RLS para envio e leitura sem bloqueios
DROP POLICY IF EXISTS "messages_full_access" ON public.messages;
CREATE POLICY "messages_full_access" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "direct_messages_full_access" ON public.direct_messages;
CREATE POLICY "direct_messages_full_access" ON public.direct_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Re-grant access just in case
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.direct_messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.direct_messages TO service_role;

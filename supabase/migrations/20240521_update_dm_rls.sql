-- Garantir coluna e índice para performance
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_dm_unread ON public.direct_messages(recipient_id, is_read);

-- Permitir UPDATE para o destinatário marcar a mensagem como lida
DROP POLICY IF EXISTS "direct_messages_update_read" ON public.direct_messages;
CREATE POLICY "direct_messages_update_read" ON public.direct_messages 
FOR UPDATE TO authenticated 
USING (recipient_id = auth.uid()) 
WITH CHECK (recipient_id = auth.uid());

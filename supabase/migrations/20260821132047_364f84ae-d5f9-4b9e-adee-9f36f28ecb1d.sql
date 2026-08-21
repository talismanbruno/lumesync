-- Adiciona as colunas de verificação e privilégios
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Promove a conta que tem o username 'admin' (e o próprio bot Lume) para Admin e Verificado
UPDATE public.profiles SET is_admin = true, is_verified = true WHERE username IN ('admin', 'lume');

-- Garantir que a RPC de broadcast exista (caso não tenha sido criada na FASE 4)
CREATE OR REPLACE FUNCTION public.broadcast_system_update(update_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se quem chama é admin (opcional, mas bom ter)
  -- If you want strict check: IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO public.direct_messages (sender_id, recipient_id, content, is_read)
  SELECT 
    '00000000-0000-0000-0000-000000000001', -- ID do Bot Lume
    p.id,
    update_text,
    false
  FROM public.profiles p
  WHERE p.id != '00000000-0000-0000-0000-000000000001';
END;
$$;

GRANT EXECUTE ON FUNCTION public.broadcast_system_update(text) TO authenticated;

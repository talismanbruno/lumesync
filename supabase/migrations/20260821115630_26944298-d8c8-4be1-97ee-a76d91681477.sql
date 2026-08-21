CREATE OR REPLACE FUNCTION public.broadcast_system_update(update_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.direct_messages (sender_id, recipient_id, content, is_read, created_at)
  SELECT
    '00000000-0000-0000-0000-000000000001',
    id,
    update_text,
    false,
    now()
  FROM public.profiles
  WHERE id <> '00000000-0000-0000-0000-000000000001';
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_system_update(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_system_update(text) TO service_role;
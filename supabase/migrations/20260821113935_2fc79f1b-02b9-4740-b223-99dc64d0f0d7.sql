-- Corrigir segurança da função de boas-vindas
ALTER FUNCTION public.handle_new_user_welcome_dm() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome_dm() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_welcome_dm() FROM authenticated;

-- Fix security issues for create_server function
ALTER FUNCTION public.create_server(text) SET search_path = public;

-- Revoke execute from public/anon since only authenticated users should create servers
REVOKE EXECUTE ON FUNCTION public.create_server(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_server(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_server(text) TO authenticated;

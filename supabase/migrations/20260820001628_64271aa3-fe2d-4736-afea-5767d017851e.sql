-- Revoke all permissions on the function then grant to service_role (which trigger uses)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- The trigger executes as the owner (usually postgres or service_role), so it doesn't need explicit grant to anon/auth

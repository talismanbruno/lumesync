-- Function to find profile by username (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_profile_by_username(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(TRIM(LEADING '@' FROM TRIM(p_username)))
  LIMIT 1;
END;
\$\$;

GRANT EXECUTE ON FUNCTION public.find_profile_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_profile_by_username(text) TO service_role;

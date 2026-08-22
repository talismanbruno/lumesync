DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  (
    (is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())) AND
    (is_verified IS NOT DISTINCT FROM (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid()))
  )
);

DROP FUNCTION IF EXISTS public.find_profile_by_username(text);

CREATE OR REPLACE FUNCTION public.find_profile_by_username(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  is_verified boolean
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, display_name, avatar_url, is_admin, is_verified
  FROM public.profiles
  WHERE lower(username) = lower(p_username);
$$;
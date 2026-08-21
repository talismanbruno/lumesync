ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS banner_url text,
ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
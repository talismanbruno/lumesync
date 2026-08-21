ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;

-- Assegurar que os nomes de usuários admin tenham badges
-- (Já implementado na lógica de exibição baseada no e-mail, mas podemos adicionar flag se necessário)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_verified') THEN
        ALTER TABLE public.profiles ADD COLUMN is_verified boolean DEFAULT false;
    END IF;
END $$;

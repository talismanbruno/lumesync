-- Resetar a senha do admin@lume.com para Lume@2026
UPDATE auth.users 
SET encrypted_password = crypt('Lume@2026', gen_salt('bf')) 
WHERE email = 'admin@lume.com';

-- Promover o perfil correspondente a Admin e Verificado
UPDATE public.profiles 
SET is_admin = true, is_verified = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@lume.com');

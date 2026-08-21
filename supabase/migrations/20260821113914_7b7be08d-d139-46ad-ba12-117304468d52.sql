-- Criar o usuário no auth.users primeiro para satisfazer a FK
-- Nota: Usando um hash de senha dummy pois o auth.users exige
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'bot@lume.chat',
  '$2a$10$abcdefghijklmnopqrstuv', -- dummy hash
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  'authenticated',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Agora criar o perfil
INSERT INTO public.profiles (id, username, display_name, avatar_url, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'lume',
  'Lume',
  'https://i.ibb.co/99YTNvGS/image.png',
  'online'
)
ON CONFLICT (id) DO UPDATE SET 
  display_name = 'Lume',
  avatar_url = 'https://i.ibb.co/99YTNvGS/image.png';

-- Adicionar controle de leitura
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Trigger de boas-vindas
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_dm()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.direct_messages (sender_id, recipient_id, content, is_read)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    new.id,
    'Bem-vindo ao Lume! 🚀 Este é o seu canal oficial de novidades. Fique de olho por aqui para conferir novas funções e melhorias.',
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_welcome_dm ON auth.users;
CREATE TRIGGER on_auth_user_welcome_dm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_welcome_dm();

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.direct_messages TO authenticated;

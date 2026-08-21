-- As tabelas já existem no schema 'storage' do Supabase.
-- As permissões RLS abaixo permitem que usuários autenticados criem e atualizem arquivos,
-- e que qualquer um (public) leia os arquivos se o bucket for público.

-- Políticas de leitura pública para os objetos
DROP POLICY IF EXISTS "public_read_storage" ON storage.objects;
CREATE POLICY "public_read_storage" ON storage.objects 
FOR SELECT TO public USING (bucket_id IN ('chat-attachments', 'avatars', 'banners'));

-- Políticas de upload para usuários autenticados
DROP POLICY IF EXISTS "auth_insert_storage" ON storage.objects;
CREATE POLICY "auth_insert_storage" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('chat-attachments', 'avatars', 'banners'));

DROP POLICY IF EXISTS "auth_update_storage" ON storage.objects;
CREATE POLICY "auth_update_storage" ON storage.objects 
FOR UPDATE TO authenticated USING (bucket_id IN ('chat-attachments', 'avatars', 'banners'));

DROP POLICY IF EXISTS "auth_delete_storage" ON storage.objects;
CREATE POLICY "auth_delete_storage" ON storage.objects 
FOR DELETE TO authenticated USING (bucket_id IN ('chat-attachments', 'avatars', 'banners'));

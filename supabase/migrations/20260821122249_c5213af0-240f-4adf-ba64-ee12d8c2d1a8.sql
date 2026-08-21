DO $$
BEGIN
    -- chat-attachments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Chat Attachments Authenticated' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Chat Attachments Authenticated" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'chat-attachments') WITH CHECK (bucket_id = 'chat-attachments');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Chat Attachments Public' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Chat Attachments Public" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'chat-attachments');
    END IF;

    -- avatars
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatars Authenticated' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Avatars Authenticated" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Avatars Public' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Avatars Public" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'avatars');
    END IF;

    -- banners
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Banners Authenticated' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Banners Authenticated" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'banners') WITH CHECK (bucket_id = 'banners');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Banners Public' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Banners Public" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'banners');
    END IF;
END
$$;

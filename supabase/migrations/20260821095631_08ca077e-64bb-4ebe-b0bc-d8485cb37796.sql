-- Helper functions (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_server_member(_server_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m WHERE m.server_id = _server_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_server_owner(_server_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.servers s WHERE s.id = _server_id AND s.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.requester_id = auth.uid() AND f.addressee_id = _profile_id)
         OR (f.addressee_id = auth.uid() AND f.requester_id = _profile_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.members m1
      JOIN public.members m2 ON m1.server_id = m2.server_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = _profile_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.channel_server_id(_channel_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.server_id FROM public.channels c WHERE c.id = _channel_id;
$$;

-- Drop permissive policies
DROP POLICY IF EXISTS "members_allow_all" ON public.members;
DROP POLICY IF EXISTS "servers_allow_all" ON public.servers;
DROP POLICY IF EXISTS "channels_allow_all" ON public.channels;
DROP POLICY IF EXISTS "messages_allow_all" ON public.messages;
DROP POLICY IF EXISTS "friendships_all" ON public.friendships;
DROP POLICY IF EXISTS "direct_messages_all" ON public.direct_messages;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- PROFILES
CREATE POLICY "profiles_select_related" ON public.profiles FOR SELECT TO authenticated
USING (public.can_view_profile(id));

-- SERVERS
CREATE POLICY "servers_select_members" ON public.servers FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_server_member(id));
CREATE POLICY "servers_insert_owner" ON public.servers FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "servers_update_owner" ON public.servers FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- MEMBERS
CREATE POLICY "members_select_same_server" ON public.members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_server_member(server_id));
CREATE POLICY "members_insert_self" ON public.members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'member');
CREATE POLICY "members_insert_owner" ON public.members FOR INSERT TO authenticated
WITH CHECK (public.is_server_owner(server_id));
CREATE POLICY "members_update_owner" ON public.members FOR UPDATE TO authenticated
USING (public.is_server_owner(server_id)) WITH CHECK (public.is_server_owner(server_id));
CREATE POLICY "members_delete_self_or_owner" ON public.members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_server_owner(server_id));

-- CHANNELS
CREATE POLICY "channels_select_members" ON public.channels FOR SELECT TO authenticated
USING (public.is_server_member(server_id));
CREATE POLICY "channels_insert_owner" ON public.channels FOR INSERT TO authenticated
WITH CHECK (public.is_server_owner(server_id));
CREATE POLICY "channels_update_owner" ON public.channels FOR UPDATE TO authenticated
USING (public.is_server_owner(server_id)) WITH CHECK (public.is_server_owner(server_id));
CREATE POLICY "channels_delete_owner" ON public.channels FOR DELETE TO authenticated
USING (public.is_server_owner(server_id));

-- MESSAGES
CREATE POLICY "messages_select_members" ON public.messages FOR SELECT TO authenticated
USING (public.is_server_member(public.channel_server_id(channel_id)));
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_server_member(public.channel_server_id(channel_id)));
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_delete_own_or_owner" ON public.messages FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_server_owner(public.channel_server_id(channel_id)));

-- FRIENDSHIPS
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "friendships_insert_requester" ON public.friendships FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid() AND addressee_id <> auth.uid());
CREATE POLICY "friendships_update_participants" ON public.friendships FOR UPDATE TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid())
WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "friendships_delete_participants" ON public.friendships FOR DELETE TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- DIRECT MESSAGES
CREATE POLICY "dm_select_participants" ON public.direct_messages FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "dm_insert_sender" ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());
CREATE POLICY "dm_delete_sender" ON public.direct_messages FOR DELETE TO authenticated
USING (sender_id = auth.uid());

-- RPC: find a user by username without exposing all profiles
CREATE OR REPLACE FUNCTION public.find_profile_by_username(p_username text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.username ILIKE p_username
  LIMIT 1;
$$;

-- RPC: join a server via invite code without exposing all servers
CREATE OR REPLACE FUNCTION public.join_server_by_invite(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_server_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT s.id INTO v_server_id FROM public.servers s WHERE s.invite_code = p_code;
  IF v_server_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.members (server_id, user_id, role)
  VALUES (v_server_id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
  RETURN v_server_id;
END;
$$;

-- Harden existing SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.create_server(server_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_server_id uuid; new_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF server_name IS NULL OR length(trim(server_name)) = 0 OR length(server_name) > 60 THEN
    RAISE EXCEPTION 'Invalid server name';
  END IF;
  new_code := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.servers (name, owner_id, invite_code)
  VALUES (trim(server_name), auth.uid(), new_code) RETURNING id INTO new_server_id;
  INSERT INTO public.members (server_id, user_id, role) VALUES (new_server_id, auth.uid(), 'owner');
  INSERT INTO public.channels (server_id, name, type) VALUES (new_server_id, 'geral', 'text');
  INSERT INTO public.channels (server_id, name, type) VALUES (new_server_id, 'Sala de Voz', 'voice');
  RETURN new_server_id;
END;
$$;

-- Trigger-only function must not be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_server_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_server_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.channel_server_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_server(text) FROM anon;
REVOKE ALL ON FUNCTION public.find_profile_by_username(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_server_by_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text) TO authenticated;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_server_member(_server_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.members m WHERE m.server_id = _server_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_server_owner(_server_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.servers s WHERE s.id = _server_id AND s.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(_profile_id uuid)
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

CREATE OR REPLACE FUNCTION private.channel_server_id(_channel_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.server_id FROM public.channels c WHERE c.id = _channel_id;
$$;

-- Repoint policies to the private helpers
DROP POLICY IF EXISTS "profiles_select_related" ON public.profiles;
CREATE POLICY "profiles_select_related" ON public.profiles FOR SELECT TO authenticated
USING (private.can_view_profile(id));

DROP POLICY IF EXISTS "servers_select_members" ON public.servers;
CREATE POLICY "servers_select_members" ON public.servers FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR private.is_server_member(id));

DROP POLICY IF EXISTS "members_select_same_server" ON public.members;
CREATE POLICY "members_select_same_server" ON public.members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_server_member(server_id));
DROP POLICY IF EXISTS "members_insert_owner" ON public.members;
CREATE POLICY "members_insert_owner" ON public.members FOR INSERT TO authenticated
WITH CHECK (private.is_server_owner(server_id));
DROP POLICY IF EXISTS "members_update_owner" ON public.members;
CREATE POLICY "members_update_owner" ON public.members FOR UPDATE TO authenticated
USING (private.is_server_owner(server_id)) WITH CHECK (private.is_server_owner(server_id));
DROP POLICY IF EXISTS "members_delete_self_or_owner" ON public.members;
CREATE POLICY "members_delete_self_or_owner" ON public.members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR private.is_server_owner(server_id));

DROP POLICY IF EXISTS "channels_select_members" ON public.channels;
CREATE POLICY "channels_select_members" ON public.channels FOR SELECT TO authenticated
USING (private.is_server_member(server_id));
DROP POLICY IF EXISTS "channels_insert_owner" ON public.channels;
CREATE POLICY "channels_insert_owner" ON public.channels FOR INSERT TO authenticated
WITH CHECK (private.is_server_owner(server_id));
DROP POLICY IF EXISTS "channels_update_owner" ON public.channels;
CREATE POLICY "channels_update_owner" ON public.channels FOR UPDATE TO authenticated
USING (private.is_server_owner(server_id)) WITH CHECK (private.is_server_owner(server_id));
DROP POLICY IF EXISTS "channels_delete_owner" ON public.channels;
CREATE POLICY "channels_delete_owner" ON public.channels FOR DELETE TO authenticated
USING (private.is_server_owner(server_id));

DROP POLICY IF EXISTS "messages_select_members" ON public.messages;
CREATE POLICY "messages_select_members" ON public.messages FOR SELECT TO authenticated
USING (private.is_server_member(private.channel_server_id(channel_id)));
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND private.is_server_member(private.channel_server_id(channel_id)));
DROP POLICY IF EXISTS "messages_delete_own_or_owner" ON public.messages;
CREATE POLICY "messages_delete_own_or_owner" ON public.messages FOR DELETE TO authenticated
USING (user_id = auth.uid() OR private.is_server_owner(private.channel_server_id(channel_id)));

DROP FUNCTION IF EXISTS public.is_server_member(uuid);
DROP FUNCTION IF EXISTS public.is_server_owner(uuid);
DROP FUNCTION IF EXISTS public.can_view_profile(uuid);
DROP FUNCTION IF EXISTS public.channel_server_id(uuid);
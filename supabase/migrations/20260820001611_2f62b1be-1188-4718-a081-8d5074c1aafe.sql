-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  status text DEFAULT 'offline',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create servers table
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) NOT NULL,
  invite_code text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

-- Create members table
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (server_id, user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.servers TO service_role;
GRANT ALL ON public.members TO service_role;

-- RLS Policies

-- Profiles: Anyone can read profiles, users can update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Servers: Members can view servers, owners can manage
CREATE POLICY "Servers are viewable by members" ON public.servers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.server_id = servers.id
      AND members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage their servers" ON public.servers
  FOR ALL TO authenticated USING (owner_id = auth.uid());

-- Members: Members can see other members in their servers
CREATE POLICY "Members can view other members in same server" ON public.members
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.members AS m
      WHERE m.server_id = members.server_id
      AND m.user_id = auth.uid()
    )
  );

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

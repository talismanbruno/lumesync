# Implementation Plan - Phase 2: Servers, Channels, and Realtime Chat

This plan implements the complete logic for Servers, Channels, and Realtime Messages as requested for Phase 2.

## Backend (Supabase)

### 1. Database Schema
- Create `channels` table: `id`, `server_id`, `name`, `type` (text/voice).
- Create `messages` table: `id`, `channel_id`, `user_id`, `content`, `created_at`.
- Enable RLS on both tables.
- Grant access to `authenticated` and `service_role`.

### 2. RLS Policies
- `channels`: Members of the server can read channels. Only owners can insert/update/delete.
- `messages`: Members of the server can read and insert messages in its channels.

### 3. Realtime
- Ensure the `messages` table is added to the `supabase_realtime` publication to enable realtime updates.

## Frontend (Dashboard)

### 1. Server Management
- Implement "Create Server" modal in the first column.
- Logic: Create server -> Insert owner into `members` -> Create default channels (#geral, 🔊 Sala de Voz) -> Navigate to the new server.
- Add "Invite Friends" functionality (copy invite code).

### 2. Channel Management
- List channels by type (Text/Voice) in the second column.
- Implement "Create Channel" button for server owners.
- Handle active channel selection state.

### 3. Realtime Chat
- Replace the chat placeholder with a functional message list and input.
- Use `supabase.channel('messages')` to listen for new messages in real-time.
- Fetch initial message history on channel switch.
- Auto-scroll to bottom on new messages.
- Display user avatars and display names in messages.

## Technical Details

### Database Migrations
```sql
-- Channels
CREATE TABLE public.channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'text' CHECK (type IN ('text', 'voice')),
    created_at timestamptz DEFAULT now()
);

-- Messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Grants
GRANT SELECT ON public.channels TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;

-- RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies (simplified logic)
CREATE POLICY "Members can view channels" ON public.channels FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.members WHERE server_id = channels.server_id AND user_id = auth.uid())
);
CREATE POLICY "Members can view messages" ON public.messages FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.channels c JOIN public.members m ON c.server_id = m.server_id WHERE c.id = messages.channel_id AND m.user_id = auth.uid())
);
CREATE POLICY "Members can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.channels c JOIN public.members m ON c.server_id = m.server_id WHERE c.id = messages.channel_id AND m.user_id = auth.uid())
);
```

### Components
- `ServerSidebar`: Column 1 navigation.
- `ChannelSidebar`: Column 2 channel list.
- `ChatArea`: Column 3 message display and input.
- `CreateServerModal`: Shadcn Dialog for new servers.

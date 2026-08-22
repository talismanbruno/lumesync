# Plan - UX/Layout Adjustments: Chat Alignment, Friends Panel, and Home Defaults

Implement structural and logic improvements to LUME's dashboard, focusing on chat presentation, interactive friends management, and default entry state.

## User Review Required

> [!IMPORTANT]
> - Friends system requires searching by exact username to send requests.
> - Chat alignment changes will remove "centered" constraints for a wider, classic view.

- **Status Badge Integration**: Verify if existing `StatusBadge.tsx` is sufficient for the Friends list.
- **Home Navigation**: Confirm if "Disponível" should be the absolute default for all new sessions.

## Proposed Changes

### Database & Backend
#### Friendships Logic
- Ensure `friendships` table supports status (pending, accepted, blocked).
- Verify `direct_messages` query joins `profiles` to get fresh metadata (display_name, avatar).

### Frontend UI/UX
#### 1. Chat Alignment & Layout
- **src/routes/_authenticated.index.tsx**:
    - Locate message containers (Server and DM views).
    - Remove `max-w-md mx-auto` or similar centering classes.
    - Apply `flex-1 w-full max-w-5xl px-8 py-4 overflow-y-auto space-y-4` to the scrollable container.
    - Ensure `MessageItem` components align content to the left consistently.

#### 2. Interactive Friends Panel
- **src/components/ui/FriendsView.tsx** (or equivalent in dashboard):
    - Implement conditional rendering for:
        - **Disponível**: Online/Idle/DND users + Action buttons (Message, Call).
        - **Todos**: List of all friends + Unfriend option.
        - **Pendentes**: Incoming (Accept/Decline) and Outgoing (Cancel) requests.
        - **Adicionar Amigo**: Input for username + Success toast via `sonner`.
    - Ensure this view replaces the "Welcome" placeholder whenever `activeTab === 'amigos'`.

#### 3. Default Home State
- **src/routes/_authenticated.index.tsx**:
    - Update `useEffect` or initial state: if no `activeServer` or `activeDM` is selected, default `activeTab` to `'amigos'` and `friendsTab` to `'disponivel'`.

#### 4. Metadata Consistency
- **Message Queries**: Update Supabase queries in `fetchMessages` and `fetchDMMessages` to fetch related profile data (`profiles!sender_id(...)`) instead of relying on stale local state or generic fallbacks.

## Technical Details

### UI Components
- **Tailwind**: Transition from container-constrained layouts to widescreen fluid layouts.
- **Lucide Icons**: Use `MessageSquare`, `Phone`, `Check`, `X`, `UserMinus` for friend actions.

### Data Fetching
- **Supabase**: Use `.select('*, profiles:sender_id(*)')` to ensure message items have access to real-time profile updates.
- **Realtime**: Ensure friends list updates when friendship status changes.

## Documentation (Verbatim)
The text provided in the request will be written to `src/routes/index.tsx` as requested.

# Plan: Group DM Improvements (Revised)

Improve the identification and visualization of Group DM members in LUME, ensuring dynamic title generation and a comprehensive member list UI.

## User Review Required
> [!IMPORTANT]
> - **Dynamic Titles**: Titles are never saved to the DB if empty. They are calculated at runtime using `getGroupTitle()`.
> - **Member Button**: A new button in the chat header opens a popover with all members.
> - **Naming Logic**:
>   - 2 total members (Local + 1 other) -> "Nome do Outro"
>   - 3 total members (Local + 2 others) -> "Nome1 e Nome2"
>   - 4+ total members -> "Nome1, Nome2 +X"
> - **Normalization**: `display_name` (trimmed) -> `username` (trimmed) -> "Usuário".
> - **Deterministic Order**: "Others" are sorted by `joined_at` then `user_id`.

## Proposed Changes

### Database & Logic Integration
- **Zero-String Persistence**: `src/components/ui/CreateGroupModal.tsx` will send `null` or `""` for the `name` field if no custom name is provided.
- **Dynamic Helper**: Centralize title calculation in `getGroupTitle(group, currentUserId)`.
- **Realtime Sync**: Ensure `dm_groups` and `dm_group_members` listeners trigger immediate state updates for:
  - Sidebar list items.
  - Chat header title.
  - Message composer placeholder.
  - Member popover list and counter.

### Component Updates (`src/routes/_authenticated.index.tsx`)
- **Data Fetching**: Update queries to include full profile data for all group members (`dm_group_members(*, profiles(*))`).
- **Chat Header**:
  - Add a "Members" button on the right with a `Users` icon and count badge.
  - Implement a `Popover` for member details:
    - Circular avatars (with initials fallback).
    - Sorted list: Local user (tagged "(Você)") first, then others.
    - Accessibility: `aria-label`, Escape key handling, and click-outside closure.
- **UI Consistency**: Use the dynamic title everywhere a group name is shown.
- **Constraint Compliance**:
  - Truncate long names in the sidebar.
  - Neutral fallback for groups with 0 other members.
  - Avoid mixing `profilesCache` with the fresh member join data to prevent stale UI.

## Technical Details
- **Group Object Structure**:
  ```typescript
  type GroupMember = { user_id: string; profiles: Profile; joined_at: string };
  type GroupDM = { id: string; name: string | null; dm_group_members: GroupMember[] };
  ```
- **Helper Implementation**:
  - `others = members.filter(m => m.user_id !== me).sort((a,b) => a.joined_at - b.joined_at || a.user_id - b.user_id)`
  - Map names through normalization.
  - Apply the requested counts (1 -> "A", 2 -> "A e B", 3+ -> "A, B +X").

## Validation Plan
- [ ] Create group with 2 total members -> Verify title is other user's name.
- [ ] Create group with 3 total members -> Verify "A e B".
- [ ] Create group with 4+ total members -> Verify "A, B +X".
- [ ] Check sidebar truncation for long names.
- [ ] Verify popover closes on Escape and shows "(Você)" for self.
- [ ] Verify DB `name` field is empty for auto-named groups.
- [ ] Ensure LUME Bot and private DMs are untouched.

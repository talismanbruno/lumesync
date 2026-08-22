# Plan: Group DM Improvements

Improve the identification and visualization of Group DM members in LUME, including automatic title generation, a member list popover, and optimized data fetching.

## User Review Required
> [!IMPORTANT]
> - Group DM titles will automatically update based on the member list if no custom name is set.
> - The new "Members" button in the chat header will show a full list of participants.
> - Data fetching for members will be integrated into the existing `dm_groups` fetch to avoid extra queries.

## Proposed Changes

### Database & Types
- Ensure `dm_group_members` includes profiles in queries.
- No schema changes required as the structure already supports this.

### Logic & Helpers
- Create a centralized helper `getGroupTitle(group, currentUserId)` to generate group names:
  - Return custom name if it exists.
  - Return "Felipe e Ana" for 2 other members.
  - Return "Felipe, Ana +2" for 3+ other members.
  - Return "Grupo com X membros" while loading.
- Create a helper `getGroupMembers(group)` to return sorted members (current user first).

### Components

#### `src/routes/_authenticated.index.tsx`
- Update `fetchConversations` to include `profiles` in `dm_group_members`.
- Implement `renderGroupHeader` with the new "Members" popover.
- The popover will display:
  - Member avatars (with initials fallback).
  - Display name/Username.
  - "(Você)" tag for the local user.
- Update `renderComposer` placeholder for groups.
- Update the sidebar group list to use the generated title.

#### `src/components/ui/CreateGroupModal.tsx`
- Ensure group creation follows the new naming fallback logic (empty name = fallback title).

## Technical Details
- **Data Source**: The `dm_groups` object in state will now include a `members` array containing profiles.
- **Naming Rule**:
  - `others = members.filter(m => m.user_id !== currentUserId)`
  - If `others.length === 1`: `others[0].name`
  - If `others.length === 2`: `others[0].name e others[1].name`
  - If `others.length > 2`: `others[0].name, others[1].name + (others.length - 2)`
- **Popover**: Use `radix-ui` `Popover` (already available via shadcn/ui).
- **Optimization**: Use existing `profilesCache` where possible to avoid redundant data.

## Validation Plan
- [ ] Create a group with 2 members -> Title shows "Name1".
- [ ] Create a group with 3 members -> Title shows "Name1 e Name2".
- [ ] Create a group with 4+ members -> Title shows "Name1, Name2 +X".
- [ ] Verify local user is excluded from title but present in member list with "(Você)".
- [ ] Test truncation for long names in sidebar.
- [ ] Verify individual DMs and Lume Bot remain unchanged.

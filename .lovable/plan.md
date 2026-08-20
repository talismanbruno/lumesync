# Implementation Plan - WebRTC Audio, Screen Share, Global Presence & Mobile Layout

Implementing real audio playback, live stream watching, background presence for the sidebar, and a full mobile-responsive layout for LUME.

## User Review Required

> [!IMPORTANT]
> - Mobile navigation will use a Sheet/Drawer component for servers and channels.
> - Background presence for the sidebar requires an additional channel listener that stays active regardless of voice room entry.

## Proposed Changes

### WebRTC & Voice Hook (`src/hooks/useVoiceRoom.ts`)
- **Audio Output**: Update `RTCPeerConnection` logic to handle `ontrack` by creating/attaching to hidden `<audio>` elements.
- **Microphone Management**: Ensure local tracks are correctly added to all new peer connections.
- **Screen Share Metadata**: Ensure `isSharingScreen` and the associated track info are broadcasted via Presence.

### Voice Room UI (`src/components/voice/VoiceRoomUI.tsx`)
- **Stage Mode**: Implement "Watch Stream" logic. When a user clicks "Watch", their stream (received via WebRTC) is promoted to the main stage.
- **Participant Cards**: Add "Watch Stream" (Eye icon) button on cards where `isSharingScreen` is true.
- **Controls**: Add a "Stop Watching" button to return to the participant grid.

### Dashboard & Sidebar (`src/routes/_authenticated.index.tsx`)
- **Background Presence**: Implement a dedicated `supabase.channel` for every voice channel visible in the sidebar. This will sync participants even for users not currently in the call.
- **Sidebar List**: Display the synced participant list (avatar + name) below the voice channel name in Column 2.
- **Mobile Responsive Layout**:
    - Wrap Column 1 (Servers) and Column 2 (Channels) in a responsive Drawer (Sheet) for screens `< 768px`.
    - Add a header bar with a hamburger menu for mobile.
    - Adjust Column 3 (Chat/Voice) to occupy full width on mobile.
    - Optimize touch targets and layout for mobile voice controls.

### Styling & Components
- **Sheet/Drawer**: Use shadcn/ui Sheet for the mobile navigation drawer.
- **Grid Layout**: Update the main dashboard container to be `flex-col` or `flex-row` based on screen size.

## Technical Details
- **Presence Listener**: A single `useEffect` in the Sidebar component will manage presence for all visible voice channels to avoid multiple connections if possible, or one per visible server.
- **WebRTC Tracks**: Using `RTCRtpReceiver` tracks to distinguish between audio (auto-played) and video (rendered on stage).
- **Audio Autoplay**: Implement a "Click to enable audio" fallback if the browser blocks initial playback.

## Constrained to Rule 11
- Professional finish with consistent spacing and theme-compliant colors (#00D1FF accent).
- Full mobile responsiveness with no broken scrollbars.
- Real-time synchronization for all states.

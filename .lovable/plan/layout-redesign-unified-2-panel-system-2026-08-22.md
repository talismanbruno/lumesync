# Layout Redesign: Unified 2-Panel System

This plan details the "REDESIGN RADICAL" to remove splash text and implement a unified 2-panel layout (Telegram/Raycast style) by consolidating the sidebar and optimizing the main canvas.

## User Review Required

> [!IMPORTANT]
> The redesign will move all server navigation, direct messages, and friends into a single 320px sidebar on the left. The top horizontal bar will be integrated into this new layout to ensure a clean, widescreen experience.

## Proposed Changes

### 1. Remove Splash Text and Blocking UI
- Clear the verbatim technical documentation currently displayed on the `/auth` route.
- Ensure the app loads directly into the functional interface (or a minimal spinner/logo).

### 2. Consolidated 2-Panel Layout overhaul (`src/routes/_authenticated.tsx`)
- **Remove** the top horizontal navigation header.
- **Remove** the separate vertical server icon dock.
- **Implement** a single 320px fixed-width left panel.
  - **Top**: Official Lume Logo + Quick Search Bar.
  - **Middle**: Unified Navigation Tabs (Capsule style): `Conversas`, `Servidores`, `Amigos`.
    - `Conversas`: DMs, Groups, and the Official Lume Bot.
    - `Servidores`: User servers and their text/voice channels.
    - `Amigos`: Friend status filters (Online, Pending, Add).
  - **Bottom**: User profile widget with status selector and settings gear.

### 3. Widescreen Canvas (`src/routes/_authenticated.index.tsx`)
- Update the main area to be a true "Floating Canvas" that occupies all remaining space.
- Remove all remaining Discord-style UI duplications.
- Ensure smooth transitions when switching between tabs in the left panel.

## Technical Details
- Consolidate layout logic into `src/routes/_authenticated.tsx`.
- Use a single `activeTab` state to drive the content of the left panel.
- Update `src/routes/_authenticated.index.tsx` to handle the broad canvas rendering based on the selection from the new unified sidebar.
- Maintain existing Realtime, WebRTC, and Supabase integration throughout the refactor.

# Plan for WebRTC Screen Share Watch Fix

Fix the "Assist Transmissão" (Watch Stream) button functionality by managing remote video streams in the voice hook and implementing a stage area in the UI to display selected remote streams.

## User Review Required

> [!IMPORTANT]
> This fix enables watching remote screen shares in a dedicated stage view within the voice room UI.

- No changes to database schema or RLS are required.
- The fix involves internal state management for WebRTC tracks.

## Technical Details

### 1. Hook Refactoring (`src/hooks/useVoiceRoom.ts`)
- Add a `remoteVideoStreams` ref to store `MediaStream` objects indexed by user ID.
- Update `RTCPeerConnection.ontrack` handler to correctly distinguish and store video tracks from remote peers.
- Add a `remoteStreamsVersion` state to trigger re-renders when a new video stream is received, as refs don't trigger updates.
- Expose `remoteVideoStreams` in the hook's return value.

### 2. Interface Refactoring (`src/components/voice/VoiceRoomUI.tsx`)
- Add `activeWatchingStream` state to track which user's stream is being viewed in the stage.
- Update the "Assistir Transmissão" button to set this state using the stream from `remoteVideoStreams`.
- Implement a Stage view that displays the selected `MediaStream` using a `<video>` element with `srcObject`.
- Add a "Parar de Assistir" button to clear the stage and return to the grid.

### 3. Main Route Integration (`src/routes/_authenticated.index.tsx`)
- Ensure the `useVoiceRoom` hook correctly passes the new `remoteVideoStreams` to the `VoiceRoomUI` component.

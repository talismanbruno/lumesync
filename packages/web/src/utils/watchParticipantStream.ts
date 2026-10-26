import { useVoiceStore } from '../stores/voiceStore';
import { getActiveRoom, setStreamSubscription } from '../hooks/useLiveKit';
import { AudioManager } from '../audio/AudioManager';
import { getSfxVolume } from './sfx';
import { encodeStreamWatch } from './streamWatchProtocol';

/** Explicit viewer actions only; automatic teardown must remain silent. */
export function notifyStreamWatch(userId: string, watching: boolean): void {
  AudioManager.getInstance().playSound(watching ? 'stream_user_joined' : 'stream_user_left', { volume: getSfxVolume() });
  const room = getActiveRoom();
  if (room) void room.localParticipant.publishData(encodeStreamWatch({ type: 'stream_watch', target: userId, watching }), { reliable: true }).catch(() => {});
}

/** Only opens a participant in the call already joined by this client. */
export function watchParticipantStream(userId: string, roomId: string): boolean {
  const state = useVoiceStore.getState();
  if (!state.isLiveKitConnected || (state.currentVoiceChannelId !== roomId && state.activeDmCall?.dmChannelId !== roomId)) return false;
  const participant = state.participants.find(person => person.userId === userId);
  if (!participant?.isScreenSharing || participant.screenTrack?.readyState === 'ended') return false;
  if (!participant.isLocal) {
    const alreadyWatching = state.watchingStreams.has(participant.userId);
    if (!alreadyWatching) state.watchStream(participant.userId);
    // Native clients can publish the screen on a separate media participant.
    setStreamSubscription(getActiveRoom(), participant.screenOwnerIdentity ?? participant.identity, true);
    if (!alreadyWatching) notifyStreamWatch(participant.userId, true);
  }
  state.setFocusedParticipant(participant.identity + ':stream');
  return true;
}

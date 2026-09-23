import type { ParticipantInfo } from './useLiveKit';

export const ANDROID_SCREEN_IDENTITY_SUFFIX = ':lume-android-screen';

/** Fold Android's screen-only companion into the user's normal participant tile. */
export function mergeAndroidScreenShareCompanions(participants: ParticipantInfo[]): ParticipantInfo[] {
  const companions = participants.filter((p) => p.identity.endsWith(ANDROID_SCREEN_IDENTITY_SUFFIX));
  const regular = participants.filter((p) => !p.identity.endsWith(ANDROID_SCREEN_IDENTITY_SUFFIX));
  return regular.map((participant) => {
    const screen = companions.find((candidate) => candidate.userId === participant.userId);
    if (!screen) return participant;
    return {
      ...participant,
      isScreenSharing: screen.isScreenSharing,
      screenTrack: screen.screenTrack,
      screenAudioTrack: screen.screenAudioTrack,
      lkScreenTrack: screen.lkScreenTrack,
      screenOwnerIdentity: screen.identity,
    };
  });
}

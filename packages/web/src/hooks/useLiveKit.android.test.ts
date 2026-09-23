import { describe, expect, it } from 'vitest';
import type { ParticipantInfo } from './useLiveKit';
import { mergeAndroidScreenShareCompanions } from './androidScreenParticipant';

function participant(identity: string, screen = false): ParticipantInfo {
  const [userId, username] = identity.split(':');
  return {
    identity,
    userId,
    username,
    homeUserId: null,
    isMuted: true,
    isDeafened: false,
    isCameraOn: false,
    isScreenSharing: screen,
    isLocal: !identity.endsWith(':lume-android-screen'),
    audioTrack: null,
    videoTrack: null,
    screenTrack: screen ? ({ id: 'native-screen' } as unknown as MediaStreamTrack) : null,
    screenAudioTrack: null,
    lkVideoTrack: null,
    lkScreenTrack: null,
    cachedUser: null,
  };
}

describe('Android screen companion participant', () => {
  it('reuses the normal user tile and attaches the native screen publication', () => {
    const result = mergeAndroidScreenShareCompanions([
      participant('user-1:ana'),
      participant('user-1:ana:lume-android-screen', true),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      identity: 'user-1:ana',
      isScreenSharing: true,
      screenOwnerIdentity: 'user-1:ana:lume-android-screen',
    });
    expect(result[0].screenTrack).not.toBeNull();
  });
});

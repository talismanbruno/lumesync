import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track, type Room } from 'livekit-client';

const fixtures = vi.hoisted(() => ({
  desktop: false,
  toast: vi.fn(),
  state: { screenShareConfig: { height: 1080, fps: 30, mode: 'gaming', customBitrateKbps: null, shareAudio: false }, hwOverdrive: false, isScreenSharing: false },
}));
vi.mock('../stores/voiceStore', () => ({ useVoiceStore: { getState: () => fixtures.state, setState: (state: object) => Object.assign(fixtures.state, state) } }));
vi.mock('../stores/uiStore', () => ({ useUIStore: { getState: () => ({ addToast: fixtures.toast }) } }));
vi.mock('../stores/settingsStore', () => ({ getStreamingLimits: () => ({ bitrateMatrixOverrides: {}, allowCustomBitrate: false, maxBitrateKbps: 50000 }) }));
vi.mock('../platform/platform', () => ({ isElectron: () => fixtures.desktop }));
vi.mock('./voice', () => ({ broadcastVoiceStatus: vi.fn() }));
vi.mock('./hwOverdrive', () => ({ activate: vi.fn(), deactivate: vi.fn() }));
import { startScreenShare } from './screenShare';

beforeEach(() => {
  vi.useFakeTimers();
  fixtures.desktop = false;
  fixtures.state.screenShareConfig.shareAudio = false;
  fixtures.state.isScreenSharing = false;
  fixtures.toast.mockReset();
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function roomWithCapture(capture: (...args: any[]) => Promise<unknown>, withAudio = false) {
  return { state: 'connected', localParticipant: {
    setScreenShareEnabled: vi.fn(capture),
    getTrackPublications: () => [
      { source: Track.Source.ScreenShare, track: { mediaStreamTrack: {} } },
      ...(withAudio ? [{ source: Track.Source.ScreenShareAudio, track: {} }] : []),
    ],
  } } as unknown as Room;
}

describe('screen share audio selection', () => {
  it('requests desktop audio even when initially off, allowing enabling it inside the picker', async () => {
    fixtures.desktop = true;
    const room = roomWithCapture(async () => {
      fixtures.state.screenShareConfig.shareAudio = true;
      return {};
    }, true);
    expect(await startScreenShare(room)).toBe(true);
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, expect.objectContaining({ audio: expect.objectContaining({ restrictOwnAudio: true, echoCancellation: false }) }), expect.any(Object));
    expect(fixtures.toast).not.toHaveBeenCalled();
  });

  it('respects disabled audio in the browser and disabled audio after the desktop picker', async () => {
    const room = roomWithCapture(async () => ({}));
    await startScreenShare(room);
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, expect.objectContaining({ audio: false }), expect.any(Object));
    fixtures.desktop = true;
    await startScreenShare(room);
    expect(fixtures.toast).not.toHaveBeenCalled();
  });

  it('keeps sharing the video and explains when the selected source supplies no audio', async () => {
    fixtures.state.screenShareConfig.shareAudio = true;
    expect(await startScreenShare(roomWithCapture(async () => ({})))).toBe(true);
    expect(fixtures.state.isScreenSharing).toBe(true);
    expect(fixtures.toast).toHaveBeenCalledWith(expect.stringContaining('sem áudio'), 'warning', 7000);
  });

  it('does not reopen the picker or mark sharing active on cancellation', async () => {
    const room = roomWithCapture(async () => { throw new DOMException('Cancelled', 'NotAllowedError'); });
    expect(await startScreenShare(room)).toBe(false);
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledOnce();
    expect(fixtures.state.isScreenSharing).toBe(false);
  });

  it('reports native capture that actually failed to exclude the app audio', async () => {
    fixtures.desktop = true;
    fixtures.state.screenShareConfig.shareAudio = true;
    const room = roomWithCapture(async () => ({}), true);
    const audioTrack = { mediaStreamTrack: { getSettings: () => ({ restrictOwnAudio: false }) } };
    room.localParticipant.getTrackPublications = () => [{ source: Track.Source.ScreenShareAudio, track: audioTrack }] as any;
    expect(await startScreenShare(room)).toBe(true);
    expect(fixtures.toast).toHaveBeenCalledWith(expect.stringContaining('eco'), 'warning', 9000);
    fixtures.toast.mockReset();
    audioTrack.mediaStreamTrack.getSettings = () => ({ restrictOwnAudio: true });
    await startScreenShare(room);
    expect(fixtures.toast).not.toHaveBeenCalled();
  });
});

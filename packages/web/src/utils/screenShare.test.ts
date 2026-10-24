import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track, type Room } from 'livekit-client';

const fixtures = vi.hoisted(() => ({
  desktop: false, toast: vi.fn(), capture: vi.fn(), supported: false,
  state: { screenShareConfig: { height: 1080 as number | 'native', fps: 30, mode: 'gaming', customBitrateKbps: null, shareAudio: true }, hwOverdrive: false, isScreenSharing: false },
}));
vi.mock('../stores/voiceStore', () => ({ useVoiceStore: { getState: () => fixtures.state, setState: (state: object) => Object.assign(fixtures.state, state) } }));
vi.mock('../stores/uiStore', () => ({ useUIStore: { getState: () => ({ addToast: fixtures.toast }) } }));
vi.mock('../stores/settingsStore', () => ({ getStreamingLimits: () => ({ bitrateMatrixOverrides: {}, allowCustomBitrate: false, minBitrateKbps: 100, maxBitrateKbps: 50000 }) }));
vi.mock('../platform/platform', () => ({ isElectron: () => fixtures.desktop }));
vi.mock('./voice', () => ({ broadcastVoiceStatus: vi.fn() }));
vi.mock('./hwOverdrive', () => ({ activate: vi.fn(), deactivate: vi.fn() }));
import { startScreenShare, stopScreenShare } from './screenShare';

function mediaTrack(kind: 'video' | 'audio', settings: Record<string, unknown> = {}) {
  const track = Object.assign(new EventTarget(), {
    kind, readyState: 'live', enabled: true, contentHint: '',
    getSettings: vi.fn(() => settings), getCapabilities: vi.fn(() => ({})),
    applyConstraints: vi.fn(async (_constraints: unknown) => {}), stop: vi.fn(),
  });
  track.stop.mockImplementation(() => { track.readyState = 'ended'; });
  return track as unknown as MediaStreamTrack & typeof track;
}
function capture(video = mediaTrack('video', { displaySurface: 'monitor' }), audio?: ReturnType<typeof mediaTrack>) {
  const tracks = audio ? [video, audio] : [video];
  const stream = { getTracks: () => tracks, getVideoTracks: () => [video], getAudioTracks: () => audio ? [audio] : [] } as unknown as MediaStream;
  fixtures.capture.mockResolvedValue(stream);
  return { video, audio, stream };
}
function room() {
  const publications: any[] = [];
  const localParticipant = {
    publishTrack: vi.fn(async (track: MediaStreamTrack, options: any) => {
      const publication = { source: options.source, track: { mediaStreamTrack: track } };
      publications.push(publication); return publication;
    }),
    unpublishTrack: vi.fn(async () => undefined),
    setScreenShareEnabled: vi.fn(async () => undefined),
    getTrackPublications: () => publications,
  };
  return { state: 'connected', localParticipant, on: vi.fn(), off: vi.fn() } as unknown as Room & { localParticipant: typeof localParticipant };
}
let currentRoom: ReturnType<typeof room>;
beforeEach(() => {
  vi.useFakeTimers(); fixtures.desktop = false; fixtures.supported = false;
  Object.assign(fixtures.state, { isScreenSharing: false, hwOverdrive: false });
  Object.assign(fixtures.state.screenShareConfig, { shareAudio: true, height: 1080 });
  fixtures.toast.mockReset(); fixtures.capture.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getDisplayMedia: fixtures.capture, getSupportedConstraints: () => ({ restrictOwnAudio: fixtures.supported }),
  } });
  currentRoom = room();
});
afterEach(async () => { await stopScreenShare(currentRoom); vi.clearAllTimers(); vi.useRealTimers(); });
const publishedAudio = () => currentRoom.localParticipant.publishTrack.mock.calls.filter(([, options]) => options.source === Track.Source.ScreenShareAudio);

describe('screen audio is isolated before publication', () => {
  it('requests isolated window audio and own-audio exclusion directly from the original gesture', async () => {
    capture();
    const pending = startScreenShare(currentRoom);
    expect(fixtures.capture).toHaveBeenCalledOnce();
    expect(fixtures.capture).toHaveBeenCalledWith(expect.objectContaining({ windowAudio: 'window', selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', audio: expect.objectContaining({ restrictOwnAudio: true, echoCancellation: false }) }));
    expect(await pending).toBe(true);
  });
  it('publishes verified system audio, independently from microphone and speech state', async () => {
    const { audio } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: true, channelCount: 2 }));
    expect(await startScreenShare(currentRoom)).toBe(true);
    expect(publishedAudio()).toEqual([[audio, expect.objectContaining({ source: Track.Source.ScreenShareAudio, forceStereo: true, dtx: false })]]);
    expect(fixtures.toast).not.toHaveBeenCalled();
  });
  it.each([false, undefined])('does not publish system audio when isolation is %s', async restriction => {
    const { video, audio } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: restriction }));
    expect(await startScreenShare(currentRoom)).toBe(true);
    expect(audio!.stop).toHaveBeenCalled(); expect(video.stop).not.toHaveBeenCalled();
    expect(publishedAudio()).toHaveLength(0); expect(fixtures.state.isScreenSharing).toBe(true);
    expect(fixtures.toast).toHaveBeenCalledWith(expect.stringContaining('exclusão das vozes'), 'warning', 10000);
  });
  it('retains audio from a separate browser tab without requiring a system-only setting', async () => {
    capture(mediaTrack('video', { displaySurface: 'browser' }), mediaTrack('audio'));
    expect(await startScreenShare(currentRoom)).toBe(true); expect(publishedAudio()).toHaveLength(1);
  });
  it('does not treat unknown surfaces or desktop sources as isolated browser tabs', async () => {
    fixtures.desktop = true;
    capture(mediaTrack('video', { displaySurface: 'browser' }), mediaTrack('audio'));
    await startScreenShare(currentRoom); expect(publishedAudio()).toHaveLength(0);
  });
  it('applies a supported restriction before publishing either track and verifies the result', async () => {
    fixtures.supported = true;
    const settings = { restrictOwnAudio: false };
    const { audio } = capture(undefined, mediaTrack('audio', settings));
    audio!.applyConstraints.mockImplementation(async () => {
      expect(currentRoom.localParticipant.publishTrack).not.toHaveBeenCalled(); settings.restrictOwnAudio = true;
    });
    await startScreenShare(currentRoom);
    expect(audio!.applyConstraints).toHaveBeenCalledWith({ restrictOwnAudio: { exact: true } });
    expect(publishedAudio()).toHaveLength(1);
  });
  it('rejects a supported restriction that is ignored or fails to apply', async () => {
    fixtures.supported = true;
    const { audio } = capture(undefined, mediaTrack('audio', {}));
    audio!.applyConstraints.mockRejectedValue(new DOMException('Unsupported', 'OverconstrainedError'));
    await startScreenShare(currentRoom); expect(publishedAudio()).toHaveLength(0);
  });
  it('does not trust a successful applyConstraints call without confirmed settings', async () => {
    fixtures.supported = true;
    capture(mediaTrack('video', {}), mediaTrack('audio'));
    await startScreenShare(currentRoom); expect(publishedAudio()).toHaveLength(0);
  });
  it('cleans up capture when stopped while an isolation check is still pending', async () => {
    fixtures.supported = true;
    const { video, audio } = capture(undefined, mediaTrack('audio', {}));
    let finish!: () => void;
    audio!.applyConstraints.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const pending = startScreenShare(currentRoom);
    await Promise.resolve(); await stopScreenShare(currentRoom); finish();
    expect(await pending).toBe(false); expect(video.stop).toHaveBeenCalled();
    expect(currentRoom.localParticipant.publishTrack).not.toHaveBeenCalled();
  });
  it('preserves the audio toggle and permits enabling it in the desktop picker', async () => {
    fixtures.desktop = true; fixtures.state.screenShareConfig.shareAudio = false;
    const { stream } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: true }));
    fixtures.capture.mockImplementation(async () => { fixtures.state.screenShareConfig.shareAudio = true; return stream; });
    await startScreenShare(currentRoom); expect(publishedAudio()).toHaveLength(1);
    expect(fixtures.state.screenShareConfig.shareAudio).toBe(true);
  });
  it('stops unexpected audio when the user disabled sharing sound', async () => {
    fixtures.state.screenShareConfig.shareAudio = false;
    const { audio } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: true }));
    await startScreenShare(currentRoom);
    expect(fixtures.capture.mock.calls[0]![0].audio).toBe(false);
    expect(audio!.stop).toHaveBeenCalled(); expect(publishedAudio()).toHaveLength(0);
  });
  it('cancels once without reopening the picker', async () => {
    fixtures.capture.mockRejectedValue(new DOMException('Cancelled', 'NotAllowedError'));
    expect(await startScreenShare(currentRoom)).toBe(false);
    expect(fixtures.capture).toHaveBeenCalledOnce(); expect(fixtures.state.isScreenSharing).toBe(false);
  });
  it('does not publish after leaving while the picker was open', async () => {
    const { video } = capture();
    fixtures.capture.mockImplementation(async () => { (currentRoom as any).state = 'disconnected'; return { getTracks: () => [video], getVideoTracks: () => [video], getAudioTracks: () => [] }; });
    expect(await startScreenShare(currentRoom)).toBe(false);
    expect(currentRoom.localParticipant.publishTrack).not.toHaveBeenCalled(); expect(video.stop).toHaveBeenCalled();
  });
  it('cleans up both raw tracks and the video publication if audio publication fails', async () => {
    const { video, audio } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: true }));
    currentRoom.localParticipant.publishTrack.mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('Publish failed'));
    expect(await startScreenShare(currentRoom)).toBe(false);
    expect(video.stop).toHaveBeenCalled(); expect(audio!.stop).toHaveBeenCalled();
    expect(currentRoom.localParticipant.unpublishTrack).toHaveBeenCalledWith(video);
    expect(currentRoom.localParticipant.unpublishTrack).toHaveBeenCalledWith(audio);
  });
  it('keeps video when isolation is lost and stops audio before asynchronous unpublication', async () => {
    const settings = { restrictOwnAudio: true };
    const { video, audio } = capture(undefined, mediaTrack('audio', settings));
    await startScreenShare(currentRoom);
    settings.restrictOwnAudio = false; audio!.dispatchEvent(new Event('unmute'));
    expect(audio!.enabled).toBe(false); expect(audio!.stop).toHaveBeenCalled(); expect(video.stop).not.toHaveBeenCalled();
    expect(currentRoom.localParticipant.unpublishTrack).toHaveBeenCalledWith(audio);
    expect(fixtures.state.isScreenSharing).toBe(true);
  });
  it('ends audio together with video when sharing is stopped in the OS picker', async () => {
    const { video, audio } = capture(undefined, mediaTrack('audio', { restrictOwnAudio: true }));
    await startScreenShare(currentRoom); video.dispatchEvent(new Event('ended'));
    expect(audio!.stop).toHaveBeenCalled();
    await Promise.resolve(); expect(fixtures.state.isScreenSharing).toBe(false);
  });
  it('ignores concurrent starts while the picker is pending', async () => {
    const { stream } = capture(); let finish!: (stream: MediaStream) => void;
    fixtures.capture.mockReturnValue(new Promise<MediaStream>(resolve => { finish = resolve; }));
    const first = startScreenShare(currentRoom);
    expect(await startScreenShare(currentRoom)).toBe(false); expect(fixtures.capture).toHaveBeenCalledOnce();
    finish(stream); expect(await first).toBe(true);
  });
});

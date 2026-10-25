import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => {
  const listeners = new Set<(state: any, previous: any) => void>();
  const state = { outputDeviceId: 'default', setOutputDevice(id: string) { const previous = { ...state }; state.outputDeviceId = id; listeners.forEach(fn => fn(state, previous)); } };
  return { state, listeners, context: null as (EventTarget & { sinkId: string }) | null, choose: vi.fn(), route: vi.fn(), enumerate: vi.fn() };
});
vi.mock('../audio/AudioManager', () => ({ AudioManager: { getInstance: () => ({ getContext: () => f.context, ensureContext: () => f.context, setOutputDevice: f.route }) } }));
vi.mock('../stores/voiceStore', () => ({ useVoiceStore: { getState: () => f.state, subscribe: (fn: any) => { f.listeners.add(fn); return () => f.listeners.delete(fn); } } }));
vi.mock('../stores/screenShareAudioOutputStore', () => ({ requestScreenAudioOutput: f.choose }));
import { isVirtualAudioOutput, prepareScreenShareOutput } from './screenShareOutput';

const devices = [
  { kind: 'audiooutput', deviceId: 'default', label: 'Default - FxSound Speakers' },
  { kind: 'audiooutput', deviceId: 'communications', label: 'Communications - FxSound Speakers' },
  { kind: 'audiooutput', deviceId: 'fx', label: 'FxSound Speakers' },
  { kind: 'audiooutput', deviceId: 'headphones', label: 'Headphones (USB Audio)' },
];
const video = (displaySurface = 'monitor') => ({ getSettings: () => ({ displaySurface }) }) as unknown as MediaStreamTrack;
const prepare = (desktop = true, surface = 'monitor') => prepareScreenShareOutput(video(surface), desktop, new AbortController().signal);
beforeEach(() => {
  f.listeners.clear(); f.state.outputDeviceId = 'default';
  f.context = Object.assign(new EventTarget(), { sinkId: '' });
  f.enumerate.mockReset().mockResolvedValue(devices);
  f.choose.mockReset().mockResolvedValue({ deviceId: 'headphones' });
  f.route.mockReset().mockImplementation(async id => { f.context!.sinkId = id; });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: Object.assign(new EventTarget(), { enumerateDevices: f.enumerate }) });
});
describe('screen audio playback route', () => {
  it.each(['FxSound Speakers','Voicemeeter Input','CABLE Input (VB-Audio Virtual Cable)','SteelSeries Sonar - Gaming','BlackHole 2ch','Wave Link System'])('identifies known rerouting output %s', label => expect(isVirtualAudioOutput(label)).toBe(true));
  it('asks for a direct output and confirms the actual audio context before allowing system audio', async () => {
    const guard = await prepare();
    expect(f.choose).toHaveBeenCalledWith('Default - FxSound Speakers', [devices[3]], expect.any(AbortSignal));
    expect(f.route).toHaveBeenCalledWith('headphones'); expect(f.state.outputDeviceId).toBe('headphones'); expect(guard.allowed).toBe(true);
    expect(guard.safe()).toBe(true);
  });
  it('does not alter output or request device information for an isolated browser tab', async () => {
    expect((await prepare(false, 'browser')).allowed).toBe(true);
    expect(f.enumerate).not.toHaveBeenCalled(); expect(f.route).not.toHaveBeenCalled(); expect(f.choose).not.toHaveBeenCalled();
  });
  it('retains an already direct output for both desktop and browser system capture', async () => {
    f.state.outputDeviceId = 'headphones'; f.context!.sinkId = 'headphones';
    expect((await prepare()).allowed).toBe(true); expect((await prepare(false)).allowed).toBe(true);
    expect(f.choose).not.toHaveBeenCalled(); expect(f.route).not.toHaveBeenCalled();
  });
  it('does not trust the desired output when the audio context is still on a virtual default', async () => {
    f.state.outputDeviceId = 'headphones'; await prepare(); expect(f.choose).toHaveBeenCalled();
  });
  it('does not publish audio if switching the actual sink fails silently', async () => {
    f.route.mockResolvedValue(undefined);
    expect((await prepare()).allowed).toBe(false); expect(f.state.outputDeviceId).toBe('default');
  });
  it('rejects a device disconnected while the route dialog was open', async () => {
    f.enumerate.mockResolvedValueOnce(devices).mockResolvedValueOnce(devices.slice(0,3));
    expect((await prepare()).allowed).toBe(false); expect(f.route).not.toHaveBeenCalled();
  });
  it('permits a deliberate video-only choice without routing any playback', async () => {
    f.choose.mockResolvedValue('silent'); const guard = await prepare();
    expect(guard.allowed).toBe(false); expect(guard.silent).toBe(true); expect(f.route).not.toHaveBeenCalled();
  });
  it('cancels before routing or publication', async () => {
    f.choose.mockResolvedValue('cancel'); await expect(prepare()).rejects.toMatchObject({ name:'AbortError' }); expect(f.route).not.toHaveBeenCalled();
  });
  it('restores the previous route when cancelled during a pending output switch', async () => {
    const abort = new AbortController();
    f.route.mockImplementationOnce(async id => { f.context!.sinkId = id; abort.abort(); });
    await expect(prepareScreenShareOutput(video(), true, abort.signal)).rejects.toMatchObject({ name:'AbortError' });
    expect(f.route).toHaveBeenLastCalledWith('default'); expect(f.state.outputDeviceId).toBe('default');
  });
  it('detects an unsafe preference switch synchronously and removes its subscription on disposal', async () => {
    const guard = await prepare(), unsafe = vi.fn(), dispose = guard.watch(unsafe);
    f.state.setOutputDevice('default'); expect(unsafe).toHaveBeenCalledOnce();
    dispose(); f.state.setOutputDevice('fx'); expect(unsafe).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
  });
  it('detects actual sink changes outside the preference store', async () => {
    const guard = await prepare(), unsafe = vi.fn(), dispose = guard.watch(unsafe);
    f.context!.sinkId = ''; f.context!.dispatchEvent(new Event('sinkchange'));
    expect(unsafe).toHaveBeenCalledOnce(); dispose();
  });
  it('detects a virtual mixer becoming the default after an OS device change', async () => {
    f.enumerate.mockResolvedValue(devices.map(d => d.deviceId === 'default' ? { ...d,label:'Default - Headphones' } : d));
    const guard = await prepare(), unsafe = vi.fn(), dispose = guard.watch(unsafe);
    f.enumerate.mockResolvedValue(devices); navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    await vi.waitFor(() => expect(unsafe).toHaveBeenCalledOnce()); dispose();
  });
});

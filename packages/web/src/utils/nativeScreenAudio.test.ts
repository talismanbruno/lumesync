import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isNativeScreenAudioTrack, startNativeScreenAudio } from './nativeScreenAudio';
const fixtures = vi.hoisted(() => ({
  close: vi.fn(async () => {}), resume: vi.fn(async () => {}), stop: vi.fn(),
  module: vi.fn(async () => {}), disconnect: vi.fn(), portClose: vi.fn(),
}));
let track: MediaStreamTrack;
beforeEach(() => {
  vi.clearAllMocks();
  track = Object.assign(new EventTarget(), { readyState: 'live', stop: fixtures.stop }) as unknown as MediaStreamTrack;
  vi.stubGlobal('AudioContext', class {
    sampleRate = 48000;
    audioWorklet = { addModule: fixtures.module };
    createMediaStreamDestination() { return { stream: { getAudioTracks: () => [track] } }; }
    resume = fixtures.resume; close = fixtures.close;
  });
  vi.stubGlobal('AudioWorkletNode', class {
    connect = vi.fn(); disconnect = fixtures.disconnect;
    port = { postMessage: vi.fn(), close: fixtures.portClose };
  });
  window.backspace = {
    platform: 'win32',
    startScreenAudio: vi.fn(async () => ({ id: 'capture', sampleRate: 48000, channels: 2 })),
    stopScreenAudio: vi.fn(), onScreenAudioData: vi.fn(() => vi.fn()), onScreenAudioEnded: vi.fn(() => vi.fn()),
  } as unknown as BackspaceElectronAPI;
});
describe('native screen audio publication source', () => {
  it('only trusts a live owned capture and tears down native and renderer resources together', async () => {
    const capture = await startNativeScreenAudio(new AbortController().signal);
    expect(capture?.track).toBe(track);
    expect(isNativeScreenAudioTrack(track)).toBe(true);
    capture?.stop(); capture?.stop();
    expect(isNativeScreenAudioTrack(track)).toBe(false);
    expect(window.backspace?.stopScreenAudio).toHaveBeenCalledExactlyOnceWith('capture');
    expect(fixtures.stop).toHaveBeenCalledTimes(1);
    expect(fixtures.close).toHaveBeenCalledTimes(1);
  });
  it('stops a late native capture when the screen picker flow was cancelled', async () => {
    const controller = new AbortController();
    let finish!: (value: { id: string; sampleRate: number; channels: number }) => void;
    window.backspace!.startScreenAudio = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const started = startNativeScreenAudio(controller.signal);
    await vi.waitFor(() => expect(finish).toBeDefined());
    controller.abort(); finish({ id: 'late', sampleRate: 48000, channels: 2 });
    await expect(started).rejects.toThrow('Capture cancelled');
    expect(window.backspace?.stopScreenAudio).toHaveBeenCalledWith('late');
    expect(isNativeScreenAudioTrack(track)).toBe(false);
  });
  it('fails closed and releases the graph if native activation fails', async () => {
    window.backspace!.startScreenAudio = vi.fn(async () => { throw new Error('unsupported'); });
    await expect(startNativeScreenAudio(new AbortController().signal)).rejects.toThrow('unsupported');
    expect(isNativeScreenAudioTrack(track)).toBe(false);
    expect(fixtures.close).toHaveBeenCalled();
  });
  it('leaves older clients and non-Windows clients on their existing capture path', async () => {
    window.backspace = undefined;
    expect(await startNativeScreenAudio(new AbortController().signal)).toBeNull();
  });
});

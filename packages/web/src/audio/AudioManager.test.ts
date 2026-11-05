import { expect, it, vi } from 'vitest';
import { AudioManager } from './AudioManager';

vi.mock('@sapphi-red/web-noise-suppressor', () => ({
  RnnoiseWorkletNode: vi.fn(),
  loadRnnoise: vi.fn(),
}));

it('discards capture returned after leaving and releases the next active stream', async () => {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const value = () => ({ value: 0, setValueAtTime: vi.fn() });
  const node = () => ({
    connect: vi.fn(), start: vi.fn(), gain: value(), frequency: value(),
    threshold: value(), knee: value(), ratio: value(), attack: value(), release: value(),
  });
  vi.stubGlobal('AudioContext', class {
    createGain = node;
    createMediaStreamDestination = node;
    createAnalyser = node;
    createDynamicsCompressor = node;
    createOscillator = node;
    createMediaStreamSource = vi.fn(() => source);
  });
  const firstTrack = { stop: vi.fn() };
  const nextTrack = { stop: vi.fn(), onended: null };
  const nextStream = { active: true, getTracks: () => [nextTrack] } as unknown as MediaStream;
  let finishCapture!: (stream: MediaStream) => void;
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
    .mockImplementationOnce(() => new Promise(resolve => { finishCapture = resolve; }))
    .mockResolvedValueOnce(nextStream);
  const audio = AudioManager.getInstance();

  try {
    const first = audio.setInputDevice('default');
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
    audio.releaseInput();
    const next = audio.setInputDevice('default');
    finishCapture({ getTracks: () => [firstTrack] } as unknown as MediaStream);
    expect(await first).toBeNull();
    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(await next).toBe(nextStream);
    expect(source.connect).toHaveBeenCalledOnce();

    // Syncing an already-disabled noise filter must reuse the pre-armed mic.
    await audio.setRnnoiseEnabled(false);
    expect(await audio.setInputDevice('default')).toBe(nextStream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(nextTrack.stop).not.toHaveBeenCalled();

    audio.releaseInput();
    expect(nextTrack.onended).toBeNull();
    expect(nextTrack.stop).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(audio.hasActiveStream()).toBe(false);
  } finally {
    audio.releaseInput();
    getUserMedia.mockRestore();
    vi.unstubAllGlobals();
  }
});

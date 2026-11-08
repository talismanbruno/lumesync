const isolatedTracks = new WeakSet<MediaStreamTrack>();
export const isNativeScreenAudioTrack = (track: MediaStreamTrack): boolean => isolatedTracks.has(track);
export interface NativeScreenAudio { track: MediaStreamTrack; stop: () => void; }

/** A fixed native backend excludes the whole Lume process tree, including Web Audio playback. */
export async function startNativeScreenAudio(signal: AbortSignal): Promise<NativeScreenAudio | null> {
  const api = window.backspace;
  if (api?.platform !== 'win32' || !api.startScreenAudio || !api.stopScreenAudio || !api.onScreenAudioData || !api.onScreenAudioEnded) return null;
  if (signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
  const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  let id: string | undefined;
  let track: MediaStreamTrack | undefined;
  let node: AudioWorkletNode | undefined;
  let unsubscribeData: (() => void) | undefined;
  let unsubscribeEnd: (() => void) | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal.removeEventListener('abort', stop);
    unsubscribeData?.();
    unsubscribeEnd?.();
    if (track) { isolatedTracks.delete(track); track.stop(); }
    node?.disconnect();
    node?.port.close();
    if (id) api.stopScreenAudio?.(id);
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}audio/nativeScreenAudio.worklet.js`);
    if (stopped) throw new DOMException('Capture cancelled', 'AbortError');
    node = new AudioWorkletNode(context, 'lume-native-screen-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    const destination = context.createMediaStreamDestination();
    node.connect(destination);
    track = destination.stream.getAudioTracks()[0];
    if (!track || context.sampleRate !== 48000) throw new Error('Native screen audio format unavailable');
    unsubscribeData = api.onScreenAudioData(data => {
      if (stopped || data.id !== id || data.pcm.byteLength % 8 || data.pcm.byteLength > 384000) return;
      const bytes = new Uint8Array(data.pcm);
      node?.port.postMessage(new Float32Array(bytes.buffer), [bytes.buffer]);
    });
    unsubscribeEnd = api.onScreenAudioEnded(data => {
      if (data.id !== id) return;
      const endedTrack = track;
      stop();
      endedTrack?.dispatchEvent(new Event('ended'));
    });
    const capture = await api.startScreenAudio();
    id = capture.id;
    if (stopped || signal.aborted) {
      api.stopScreenAudio(id);
      throw new DOMException('Capture cancelled', 'AbortError');
    }
    if (capture.sampleRate !== 48000 || capture.channels !== 2) throw new Error('Native screen audio format mismatch');
    await context.resume();
    if (stopped || signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
    isolatedTracks.add(track);
    return { track, stop };
  } catch (error) {
    stop();
    throw error;
  }
}

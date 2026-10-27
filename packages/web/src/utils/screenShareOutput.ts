import { AudioManager } from '../audio/AudioManager';
import { useVoiceStore } from '../stores/voiceStore';
import { requestScreenAudioOutput } from '../stores/screenShareAudioOutputStore';

// Process exclusion cannot remove audio re-emitted by an external mixer.
// This list identifies known routing products; it is not a hardware certification.
export function isVirtualAudioOutput(label: string): boolean {
  return /fxsound|voicemeeter|vb[- ]?audio|virtual\s+(?:audio|cable)|cable\s+input|steelseries.*sonar|sonar.*(?:gaming|chat|stream)|wave\s*link|elgato.*(?:wave|sound)|blackhole|soundflower|loopback\s+audio/i.test(label);
}
type Output = Pick<MediaDeviceInfo, 'deviceId' | 'label' | 'kind'>;
// OS aliases can change endpoints underneath an active capture, including to
// an external mixer. A readable label on "default" is not a pinned route.
function isDirectOutput(output: Output | undefined): boolean {
  return !!output?.label && !['', 'default', 'communications'].includes(output.deviceId) && !isVirtualAudioOutput(output.label);
}
export function resolveScreenShareOutput(devices: Output[], deviceId: string): Output | undefined {
  return devices.find(device => device.kind === 'audiooutput' && device.deviceId === (deviceId || 'default'));
}
export interface ScreenShareOutputGuard { allowed: boolean; silent?: boolean; safe: () => boolean; watch: (onUnsafe: () => void) => () => void; }
const unrestricted: ScreenShareOutputGuard = { allowed: true, safe: () => true, watch: () => () => {} };

/** Resolves before publication. Never gates transmission on voice activity. */
export async function prepareScreenShareOutput(video: MediaStreamTrack, desktop: boolean, signal: AbortSignal): Promise<ScreenShareOutputGuard> {
  if (!desktop && video.getSettings().displaySurface === 'browser') return unrestricted;
  let outputs: MediaDeviceInfo[];
  try { outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput'); }
  catch { return { ...unrestricted, allowed: false }; }
  if (signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
  const audio = AudioManager.getInstance();
  const actualOutput = () => {
    const ctx = audio.getContext();
    return ctx && 'sinkId' in ctx && typeof ctx.sinkId === 'string' ? ctx.sinkId || 'default' : 'default';
  };
  const intendedOutput = () => useVoiceStore.getState().outputDeviceId || 'default';
  const initial = resolveScreenShareOutput(outputs, actualOutput() ?? intendedOutput());
  if (!isDirectOutput(initial)) {
    const choices = outputs.filter(isDirectOutput);
    const choice = await requestScreenAudioOutput(initial?.label || 'Padrão do sistema', choices, signal);
    if (choice === 'cancel' || signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
    if (choice === 'silent') return { ...unrestricted, allowed: false, silent: true };
    // Re-enumerate after the dialog: a chosen device may have disappeared.
    outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    if (signal.aborted) throw new DOMException('Capture cancelled', 'AbortError');
    const selected = resolveScreenShareOutput(outputs, choice.deviceId);
    if (!isDirectOutput(selected)) return { ...unrestricted, allowed: false };
    const previousOutput = intendedOutput();
    audio.ensureContext();
    await audio.setOutputDevice(choice.deviceId);
    if (signal.aborted) {
      await audio.setOutputDevice(previousOutput);
      throw new DOMException('Capture cancelled', 'AbortError');
    }
    // setOutputDevice handles unsupported sinks/errors for general playback.
    // Here require confirmation from the actual AudioContext before publishing.
    if (actualOutput() !== choice.deviceId) {
      await audio.setOutputDevice(previousOutput);
      return { ...unrestricted, allowed: false };
    }
    useVoiceStore.getState().setOutputDevice(choice.deviceId);
  }
  const safe = () => {
    const intended = resolveScreenShareOutput(outputs, intendedOutput());
    const actual = resolveScreenShareOutput(outputs, actualOutput() ?? intendedOutput());
    return isDirectOutput(intended) && isDirectOutput(actual) && actual?.deviceId === intended?.deviceId;
  };
  return { allowed: safe(), safe, watch(onUnsafe) {
    let disposed = false;
    let enumeration = 0;
    const unsubscribe = useVoiceStore.subscribe((state, previous) => {
      if (state.outputDeviceId !== previous.outputDeviceId && !safe()) onUnsafe();
    });
    const changed = async () => {
      const current = ++enumeration;
      try { const next = await navigator.mediaDevices.enumerateDevices(); if (disposed || current !== enumeration) return; outputs = next.filter(d => d.kind === 'audiooutput'); }
      catch { if (disposed || current !== enumeration) return; outputs = []; }
      if (!disposed && !safe()) onUnsafe();
    };
    navigator.mediaDevices.addEventListener('devicechange', changed);
    const context = audio.getContext();
    const sinkChanged = () => { if (!safe()) onUnsafe(); };
    context?.addEventListener('sinkchange', sinkChanged);
    return () => { disposed = true; unsubscribe(); navigator.mediaDevices.removeEventListener('devicechange', changed); context?.removeEventListener('sinkchange', sinkChanged); };
  } };
}

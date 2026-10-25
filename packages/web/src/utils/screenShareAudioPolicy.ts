/** Display audio is a separate source from microphone audio. Never gate it on speech. */
type IsolatedAudioSettings = MediaTrackSettings & { restrictOwnAudio?: boolean };
type IsolatedAudioCapabilities = MediaTrackCapabilities & { restrictOwnAudio?: boolean[] };
type IsolatedAudioConstraints = MediaTrackConstraints & { restrictOwnAudio: { exact: true } };

export function hasIsolatedScreenAudio(video: MediaStreamTrack, audio: MediaStreamTrack, desktop: boolean): boolean {
  if (audio.readyState !== 'live' || video.readyState !== 'live') return false;
  // A separate browser tab has its own audio source. The capturing tab is
  // excluded from the picker, and in-picker source switching is disabled.
  if (!desktop && video.getSettings().displaySurface === 'browser') return true;
  const settings = audio.getSettings() as IsolatedAudioSettings;
  // Electron's custom picker can report the preference even on a global
  // loopback backend (notably Linux). Require the native exclusion source too.
  if (desktop && settings.deviceId !== 'loopbackWithoutChrome') return false;
  return settings.restrictOwnAudio === true;
}

export async function isolateScreenAudio(video: MediaStreamTrack, audio: MediaStreamTrack, desktop: boolean): Promise<boolean> {
  if (hasIsolatedScreenAudio(video, audio, desktop)) return true;
  if (audio.readyState !== 'live' || video.readyState !== 'live') return false;
  // Support alone is insufficient: require the returned track to confirm it.
  // exact/min are prohibited in the initial getDisplayMedia request, but an
  // acquired track may be constrained before any audio packet is published.
  try {
    const capabilities = audio.getCapabilities?.() as IsolatedAudioCapabilities | undefined;
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() as (MediaTrackSupportedConstraints & { restrictOwnAudio?: boolean }) | undefined;
    if (!capabilities?.restrictOwnAudio?.includes(true) && !supported?.restrictOwnAudio) return false;
    await audio.applyConstraints({ restrictOwnAudio: { exact: true } } as IsolatedAudioConstraints);
    return hasIsolatedScreenAudio(video, audio, desktop);
  } catch {
    return false;
  }
}

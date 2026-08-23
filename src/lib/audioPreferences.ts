export interface AudioPreferences {
  inputDeviceId: string;
  outputDeviceId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  callSounds: boolean;
  desktopNotifications: boolean;
}

const STORAGE_KEY = 'lume:audio-preferences';
export const AUDIO_PREFERENCES_EVENT = 'lume:audio-preferences-changed';

export const defaultAudioPreferences: AudioPreferences = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  callSounds: true,
  desktopNotifications: false
};

export function getAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') return defaultAudioPreferences;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...defaultAudioPreferences, ...stored };
  } catch {
    return defaultAudioPreferences;
  }
}

export function setAudioPreferences(changes: Partial<AudioPreferences>): AudioPreferences {
  const next = { ...getAudioPreferences(), ...changes };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<AudioPreferences>(AUDIO_PREFERENCES_EVENT, { detail: next }));
  return next;
}

export function getMicrophoneConstraints(preferences = getAudioPreferences()): MediaTrackConstraints {
  return {
    deviceId: preferences.inputDeviceId && preferences.inputDeviceId !== 'default'
      ? { exact: preferences.inputDeviceId }
      : undefined,
    echoCancellation: preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGainControl
  };
}

export async function applyOutputDevice(element: HTMLMediaElement, deviceId: string): Promise<void> {
  const sinkElement = element as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
  if (sinkElement.setSinkId) await sinkElement.setSinkId(deviceId || 'default');
}


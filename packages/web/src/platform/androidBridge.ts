import { getApiForOrigin } from '../utils/crossStoreResolvers';
import { getChannelOrigin } from '../stores/spaceStore';
import { useVoiceStore } from '../stores/voiceStore';

interface NativeScreenShareEventDetail {
  active: boolean;
  error?: string;
}

interface LumeAndroidHost {
  postMessage(message: string): void;
}

declare global {
  interface Window {
    LumeAndroid?: LumeAndroidHost;
  }
}

const EVENT_NAME = 'lume-native-screen-share';

export function hasAndroidNativeHost(): boolean {
  return typeof window.LumeAndroid?.postMessage === 'function';
}

export function setAndroidCallActive(active: boolean): void {
  if (!hasAndroidNativeHost()) return;
  window.LumeAndroid!.postMessage(JSON.stringify({ type: active ? 'startCall' : 'stopCall' }));
}

function waitForNativeState(expected: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(EVENT_NAME, listener as EventListener);
      reject(new Error('O Android não respondeu ao pedido de compartilhamento.'));
    }, 30_000);
    const listener = (event: CustomEvent<NativeScreenShareEventDetail>) => {
      if (event.detail.error) {
        window.clearTimeout(timeout);
        window.removeEventListener(EVENT_NAME, listener as EventListener);
        reject(new Error(event.detail.error));
      } else if (event.detail.active === expected) {
        window.clearTimeout(timeout);
        window.removeEventListener(EVENT_NAME, listener as EventListener);
        resolve();
      }
    };
    window.addEventListener(EVENT_NAME, listener as EventListener);
  });
}

export async function startAndroidScreenShare(): Promise<void> {
  const host = window.LumeAndroid;
  if (!host) throw new Error('Host Android indisponível.');
  const voice = useVoiceStore.getState();
  const dmId = voice.activeDmCall?.dmChannelId;
  const channelId = voice.currentVoiceChannelId;
  if (!dmId && !channelId) throw new Error('Entre em uma chamada antes de compartilhar a tela.');
  const origin = voice.callOrigin || getChannelOrigin(dmId ?? channelId!);
  const client = getApiForOrigin(origin);
  const credentials = dmId
    ? await client.livekit.dmToken(dmId, { nativeScreenShare: true })
    : await client.livekit.token(channelId!, { nativeScreenShare: true });
  const completed = waitForNativeState(true);
  host.postMessage(JSON.stringify({ type: 'startScreenShare', url: credentials.url, token: credentials.token }));
  await completed;
}

export async function stopAndroidScreenShare(): Promise<void> {
  const host = window.LumeAndroid;
  if (!host) return;
  const completed = waitForNativeState(false);
  host.postMessage(JSON.stringify({ type: 'stopScreenShare' }));
  await completed;
}

/** Keeps the canonical web voice store in sync when Android/MediaProjection stops. */
export function subscribeAndroidScreenShareState(onState: (error?: string) => void): () => void {
  if (!hasAndroidNativeHost()) return () => {};
  const listener = (event: CustomEvent<NativeScreenShareEventDetail>) => {
    const { active, error } = event.detail;
    const voice = useVoiceStore.getState();
    if (voice.isScreenSharing !== active) voice.toggleScreenShare();
    onState(error);
  };
  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}

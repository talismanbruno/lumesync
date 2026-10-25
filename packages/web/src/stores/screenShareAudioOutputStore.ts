import { create } from 'zustand';

export type ScreenAudioOutputChoice = { deviceId: string } | 'silent' | 'cancel';
export interface ScreenAudioOutputRequest {
  deviceLabel: string;
  devices: { deviceId: string; label: string }[];
  choose: (choice: ScreenAudioOutputChoice) => void;
}
export const useScreenShareAudioOutputStore = create<{ request: ScreenAudioOutputRequest | null }>(() => ({ request: null }));

export function requestScreenAudioOutput(deviceLabel: string, devices: ScreenAudioOutputRequest['devices'], signal: AbortSignal): Promise<ScreenAudioOutputChoice> {
  if (signal.aborted) return Promise.resolve('cancel');
  return new Promise(resolve => {
    let finished = false;
    const choose = (choice: ScreenAudioOutputChoice) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', cancel);
      if (useScreenShareAudioOutputStore.getState().request?.choose === choose) useScreenShareAudioOutputStore.setState({ request: null });
      resolve(choice);
    };
    const cancel = () => choose('cancel');
    useScreenShareAudioOutputStore.getState().request?.choose('cancel');
    useScreenShareAudioOutputStore.setState({ request: { deviceLabel, devices, choose } });
    signal.addEventListener('abort', cancel, { once: true });
  });
}

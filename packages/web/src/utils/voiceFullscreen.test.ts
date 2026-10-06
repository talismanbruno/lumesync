import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../stores/uiStore';
import { toggleVoiceFullscreen } from './voiceFullscreen';

beforeEach(() => {
  useUIStore.setState({ voiceFullscreen: false, toasts: [] });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: undefined });
});

describe('voice fullscreen', () => {
  it('requests native fullscreen synchronously in the click gesture', async () => {
    const target = document.createElement('div');
    const request = vi.fn().mockResolvedValue(undefined);
    target.requestFullscreen = request;
    const pending = toggleVoiceFullscreen(target);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.instances[0]).toBe(target);
    await pending;
    expect(useUIStore.getState().voiceFullscreen).toBe(true);
  });

  it('exits native mode before clearing the UI state', async () => {
    const target = document.createElement('div');
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: target });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    useUIStore.setState({ voiceFullscreen: true });
    await toggleVoiceFullscreen(target);
    expect(exit).toHaveBeenCalledOnce();
    expect(useUIStore.getState().voiceFullscreen).toBe(false);
  });

  it('supports expanding and closing on browsers without the native API', async () => {
    const target = document.createElement('div');
    await toggleVoiceFullscreen(target);
    expect(useUIStore.getState().voiceFullscreen).toBe(true);
    await toggleVoiceFullscreen(target);
    expect(useUIStore.getState().voiceFullscreen).toBe(false);
  });

  it('clears fullscreen state and explains a rejected request', async () => {
    const target = document.createElement('div');
    target.requestFullscreen = vi.fn().mockRejectedValue(new Error('Denied'));
    await toggleVoiceFullscreen(target);
    expect(useUIStore.getState().voiceFullscreen).toBe(false);
    expect(useUIStore.getState().toasts).toHaveLength(1);
  });
});

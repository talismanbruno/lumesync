import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureDesktopRendering } from './desktopRendering';

afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.lumeRuntime; });
describe('native Mac rendering policy', () => {
  it('applies to native Mac clients, including existing preload bridges', () => {
    vi.stubGlobal('backspace', { platform: 'darwin' });
    configureDesktopRendering();
    expect(document.documentElement.dataset.lumeRuntime).toBe('mac-desktop');
  });
  it('keeps the browser and other desktop platforms on the normal material', () => {
    for (const bridge of [undefined, { platform: 'win32' }, { platform: 'linux' }]) {
      vi.stubGlobal('backspace', bridge);
      configureDesktopRendering();
      expect(document.documentElement.dataset.lumeRuntime).toBeUndefined();
    }
  });
});

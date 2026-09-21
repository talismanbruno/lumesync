import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe('first mobile render', () => {
  it('selects the mobile shell and DM tab immediately on a phone DM link', async () => {
    vi.stubGlobal('innerWidth', 375);
    window.history.replaceState({}, '', '/channels/@me');
    vi.resetModules();
    const { useUIStore } = await import('./uiStore');
    expect(useUIStore.getState().isMobile).toBe(true);
    expect(useUIStore.getState().mobileScreen).toBe('dms');
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('keeps the desktop shell at wide widths', async () => {
    vi.stubGlobal('innerWidth', 1024);
    window.history.replaceState({}, '', '/channels/@me');
    vi.resetModules();
    const { useUIStore } = await import('./uiStore');
    expect(useUIStore.getState().isMobile).toBe(false);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});

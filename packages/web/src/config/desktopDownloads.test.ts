import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDesktopDownload,
  LUME_DESKTOP_RELEASE_URL,
  LUME_DESKTOP_VERSION,
} from './desktopDownloads';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('desktop downloads', () => {
  it('keeps the release page aligned with the advertised desktop version', () => {
    expect(LUME_DESKTOP_RELEASE_URL).toContain(`lume-desktop-v${LUME_DESKTOP_VERSION}`);
  });

  it('points Windows users at the installer for the advertised version', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' });

    const download = getDesktopDownload();

    expect(download.url).toContain(
      `/lume-desktop-v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-x64.exe`,
    );
    expect(download.filename).toBe(`Lume-${LUME_DESKTOP_VERSION}-x64.exe`);
  });
});

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
    expect(LUME_DESKTOP_RELEASE_URL).toContain(`/tag/v${LUME_DESKTOP_VERSION}`);
  });

  it('points Windows users at the installer for the advertised version', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' });

    const download = getDesktopDownload();

    expect(download.url).toContain(
      `/v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-x64.exe`,
    );
    expect(download.filename).toBe(`Lume-${LUME_DESKTOP_VERSION}-x64.exe`);
  });

  it('offers the matching APK on Android instead of a Linux desktop download', () => {
    vi.stubGlobal('navigator', { platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15)' });
    const download = getDesktopDownload();
    expect(download.url).toContain(`/v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-android.apk`);
    expect(download.label).toContain('Android');
  });

  it('lets Mac users choose the matching architecture on the release page', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh)' });
    expect(getDesktopDownload().url).toBe(LUME_DESKTOP_RELEASE_URL);
    expect(getDesktopDownload().detail).toContain('Apple Silicon');
  });
});

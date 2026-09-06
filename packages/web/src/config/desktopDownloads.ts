export const LUME_DESKTOP_VERSION = '1.0.0-beta.15';
export const LUME_DESKTOP_RELEASE_URL =
  `https://github.com/talismanbruno/lumesync/releases/tag/lume-desktop-v${LUME_DESKTOP_VERSION}`;

const WINDOWS_INSTALLER_URL =
  `https://github.com/talismanbruno/lumesync/releases/download/lume-desktop-v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-x64.exe`;

export interface DesktopDownload {
  url: string;
  label: string;
  detail: string;
  filename?: string;
}

export function getDesktopDownload(): DesktopDownload {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
    return {
      url: LUME_DESKTOP_RELEASE_URL,
      label: 'Baixar Lume para macOS',
      detail: 'Intel ou Apple Silicon',
    };
  }

  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.platform)) {
    return {
      url: WINDOWS_INSTALLER_URL,
      label: 'Baixar Lume para Windows',
      detail: 'Desktop Beta · 93 MB',
      filename: `Lume-${LUME_DESKTOP_VERSION}-x64.exe`,
    };
  }

  return {
    url: LUME_DESKTOP_RELEASE_URL,
    label: 'Baixar Lume Desktop',
    detail: 'Windows e macOS',
  };
}

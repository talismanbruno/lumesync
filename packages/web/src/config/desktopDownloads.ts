import { t as uiText } from '../i18n';
export const LUME_DESKTOP_VERSION = '1.0.0-beta.20';
export const LUME_DESKTOP_RELEASE_URL =
  `https://github.com/talismanbruno/lumesync/releases/tag/v${LUME_DESKTOP_VERSION}`;

const WINDOWS_INSTALLER_URL =
  `https://github.com/talismanbruno/lumesync/releases/download/v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-x64.exe`;

export interface DesktopDownload {
  url: string;
  label: string;
  detail: string;
  filename?: string;
}

export function getDesktopDownload(): DesktopDownload {
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    return {
      url: `https://github.com/talismanbruno/lumesync/releases/download/v${LUME_DESKTOP_VERSION}/Lume-${LUME_DESKTOP_VERSION}-android.apk`,
      label: 'Baixar Lume para Android',
      detail: 'APK Beta · Android 8 ou mais recente',
      filename: `Lume-${LUME_DESKTOP_VERSION}-android.apk`,
    };
  }
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
    return {
      url: LUME_DESKTOP_RELEASE_URL,
      label: uiText("Baixar Lume para macOS"),
      detail: 'Intel ou Apple Silicon',
    };
  }

  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.platform)) {
    return {
      url: WINDOWS_INSTALLER_URL,
      label: uiText("Baixar Lume para Windows"),
      detail: 'Desktop Beta · Windows Intel/AMD',
      filename: `Lume-${LUME_DESKTOP_VERSION}-x64.exe`,
    };
  }

  return {
    url: LUME_DESKTOP_RELEASE_URL,
    label: uiText("Baixar Lume Desktop"),
    detail: 'Windows, macOS e Linux',
  };
}

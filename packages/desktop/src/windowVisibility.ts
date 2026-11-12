import type { BrowserWindow } from 'electron';

export function isWindowVisible(window: BrowserWindow | null): boolean {
  return !!window && !window.isDestroyed() && window.isVisible() && !window.isMinimized();
}

/** backgroundThrottling=false keeps document.visibilityState visible during calls. */
export function attachWindowVisibility(window: BrowserWindow): void {
  const publish = () => {
    if (!window.isDestroyed()) window.webContents.send('window-visibility-changed', isWindowVisible(window));
  };
  window.on('show', publish);
  window.on('hide', publish);
  window.on('minimize', publish);
  window.on('restore', publish);
}

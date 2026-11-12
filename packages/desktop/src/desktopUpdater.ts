import type { AppUpdater, UpdateInfo } from 'electron-updater';
import { extractErrorCode, type RecoveryStateStore } from './recovery';

export const OFFICIAL_RELEASES = { provider: 'github' as const, owner: 'talismanbruno', repo: 'lumesync' };

export function validateUpdate(info: UpdateInfo, currentVersion: { compare(version: string): number }): void {
  if (currentVersion.compare(info.version) >= 0) throw new Error('A atualização não é superior à versão instalada.');
  if (!info.files?.length || info.files.some(file =>
    !/^Lume-\d+\.\d+\.\d+(?:-beta\.\d+)?(?:-(?:x64|arm64))?\.exe$/.test(file.url)
    || file.url.replace(/^Lume-/, '').replace(/(?:-(?:x64|arm64))?\.exe$/, '') !== info.version
    || !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)
    || !file.size || file.size < 1)) {
    throw new Error('Metadados de atualização inválidos ou arquivo fora do release oficial.');
  }
}

export function configureDesktopUpdater(updater: AppUpdater, store: RecoveryStateStore, notifyReady: (version: string) => void): void {
  updater.setFeedURL(OFFICIAL_RELEASES);
  updater.autoDownload = false; // Validate before starting any download.
  updater.autoInstallOnAppQuit = false; // Install only on an explicit user action.
  updater.allowPrerelease = true;
  updater.allowDowngrade = false;
  const fail = (error: unknown) => store.update({
    updateState: 'error', lastCheckResult: 'failed',
    lastUpdateError: { message: error instanceof Error ? error.message : String(error), code: extractErrorCode(error), at: Date.now() },
  });
  updater.on('checking-for-update', () => store.update({ updateState: 'checking', updateVersion: null, updateProgress: null, lastCheckResult: null, lastUpdateError: null }));
  updater.on('update-not-available', () => store.update({ updateState: 'idle', updateVersion: null, updateProgress: null, lastCheckResult: 'up-to-date', lastUpdateError: null }));
  updater.on('update-available', (info: UpdateInfo) => {
    try { validateUpdate(info, updater.currentVersion); } catch (error) { fail(error); return; }
    store.update({ updateState: 'downloading', updateVersion: info.version, updateProgress: { percent: 0, transferred: 0, total: 0 } });
    void updater.downloadUpdate().catch(fail);
  });
  updater.on('download-progress', progress => {
    store.update({ updateProgress: { percent: Math.max(0, Math.min(100, progress.percent)), transferred: progress.transferred, total: progress.total } });
  });
  updater.on('update-downloaded', (info: UpdateInfo) => {
    try { validateUpdate(info, updater.currentVersion); } catch (error) { fail(error); return; }
    store.update({ updateState: 'downloaded', updateVersion: info.version, updateProgress: { percent: 100, transferred: info.files[0]?.size ?? 0, total: info.files[0]?.size ?? 0 }, lastUpdateError: null });
    notifyReady(info.version);
  });
  updater.on('error', fail);
}

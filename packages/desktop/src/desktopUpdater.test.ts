import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { AppUpdater, UpdateInfo } from 'electron-updater';
import { configureDesktopUpdater, validateUpdate, OFFICIAL_RELEASES } from './desktopUpdater';
import { RecoveryStateStore, handleRecoveryAction, setAutoUpdater, recoveryStore } from './recovery';
vi.mock('electron', () => ({ app: { isPackaged: true }, shell: {} }));

const info = { version: '1.0.0-beta.27', files: [{ url: 'Lume-1.0.0-beta.27-x64.exe', sha512: 'a'.repeat(86) + '==', size: 1234 }], releaseDate: '2026-11-12' } as UpdateInfo;
const make = () => {
  const updater = Object.assign(new EventEmitter(), {
    setFeedURL: vi.fn(), downloadUpdate: vi.fn().mockResolvedValue([]),
    currentVersion: { compare: (version: string) => version === '1.0.0-beta.27' ? -1 : 0 },
  });
  const store = new RecoveryStateStore(), notify = vi.fn();
  configureDesktopUpdater(updater as unknown as AppUpdater, store, notify);
  return { updater, store, notify };
};

describe('official desktop update lifecycle (mocked updater)', () => {
  it('pins GitHub, allows newer betas and requires explicit installation', () => {
    const { updater } = make();
    expect(updater.setFeedURL).toHaveBeenCalledWith(OFFICIAL_RELEASES);
    expect(updater).toMatchObject({ autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: true, allowDowngrade: false });
  });
  it('downloads valid releases, persists progress and reports ready only after verification', () => {
    const { updater, store, notify } = make();
    updater.emit('checking-for-update');
    expect(store.get().updateState).toBe('checking');
    updater.emit('update-available', info);
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(store.get().updateState).toBe('downloading');
    updater.emit('download-progress', { percent: 45, transferred: 550, total: 1234 });
    expect(store.get().updateProgress?.percent).toBe(45);
    expect(notify).not.toHaveBeenCalled();
    updater.emit('update-downloaded', info);
    expect(store.get()).toMatchObject({ updateState: 'downloaded', updateVersion: info.version, updateProgress: { percent: 100 } });
    expect(notify).toHaveBeenCalledWith(info.version);
  });
  it.each(['https://evil.example/Lume-1.0.0-beta.27-x64.exe', '../Lume-1.0.0-beta.27-x64.exe', 'Lume-1.0.0-beta.27-x64.exe?cmd=bad', 'arbitrary.exe'])('rejects unexpected downloads: %s', url => {
    const { updater, store } = make();
    updater.emit('update-available', { ...info, files: [{ ...info.files[0], url }] });
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(store.get().updateState).toBe('error');
  });
  it('rejects corrupt metadata and equal or older versions', () => {
    const { updater } = make();
    expect(() => validateUpdate({ ...info, version: '1.0.0-beta.26' }, updater.currentVersion)).toThrow();
    expect(() => validateUpdate({ ...info, files: [{ ...info.files[0]!, sha512: '' }] }, updater.currentVersion)).toThrow();
  });
  it('shows up-to-date and real failures without crashing', async () => {
    const { updater, store } = make();
    updater.emit('update-not-available');
    expect(store.get().lastCheckResult).toBe('up-to-date');
    updater.downloadUpdate.mockRejectedValueOnce(Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' }));
    updater.emit('update-available', info);
    await vi.waitFor(() => expect(store.get().updateState).toBe('error'));
    expect(store.get().lastUpdateError).toMatchObject({ message: 'Connection reset', code: 'ECONNRESET' });
  });
  it('coalesces startup, periodic and manual checks through the recovery action funnel', async () => {
    const checkForUpdates = vi.fn(() => new Promise(() => {}));
    setAutoUpdater({ checkForUpdates } as unknown as AppUpdater);
    recoveryStore.update({ updateState: 'idle' });
    handleRecoveryAction('check-update'); handleRecoveryAction('check-update'); handleRecoveryAction('check-update');
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    recoveryStore.update({ updateState: 'idle' }); setAutoUpdater(null);
  });
});

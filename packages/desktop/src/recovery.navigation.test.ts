import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachRecoveryHandlers, clearBootTimer, handleRendererReady, recoveryStore,
  resetBootTimerStateForTest, setMainWindow,
} from './recovery';

const electron = vi.hoisted(() => ({ app: { isPackaged: true } }));
vi.mock('electron', () => electron);

class TestWindow extends EventEmitter {
  url = 'file:///Lume/resources/update.html';
  destroyed = false;
  webContents = Object.assign(new EventEmitter(), { getURL: () => this.url });
  isDestroyed = () => this.destroyed;
  loadFile = vi.fn().mockResolvedValue(undefined);
  show = vi.fn();
  focus = vi.fn();
  start(url = 'https://lumesocial.online/app/') {
    this.webContents.emit('did-start-navigation', { url, isMainFrame: true, isSameDocument: false });
  }
  commit(url = 'https://lumesocial.online/app/') {
    this.url = url;
    this.webContents.emit('did-navigate', {}, url);
  }
}

let win: TestWindow;
beforeEach(() => {
  vi.useFakeTimers();
  electron.app.isPackaged = true;
  resetBootTimerStateForTest();
  recoveryStore.markRecoveryExited();
  recoveryStore.update({ mode: 'normal', reason: null });
  win = new TestWindow();
  setMainWindow(win as never);
  attachRecoveryHandlers(win as never);
});
afterEach(() => {
  win.emit('closed');
  clearBootTimer();
  setMainWindow(null);
  vi.useRealTimers();
});

describe('desktop navigation recovery deadlines', () => {
  it('escapes a request that never returns a response while the old updater page stays visible', () => {
    handleRendererReady(); // Old splash finished; this must not exempt the next request.
    win.start();
    vi.advanceTimersByTime(19_999);
    expect(win.loadFile).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(recoveryStore.get().reason).toMatchObject({ code: 'load-failed', detail: expect.stringContaining('ERR_TIMED_OUT') });
    expect(win.loadFile).toHaveBeenCalledTimes(1);
    expect(win.show).toHaveBeenCalled();
  });

  it('detects a committed page whose resources never finish and renderer never boots', () => {
    win.start(); win.commit();
    vi.advanceTimersByTime(20_000);
    expect(recoveryStore.get().reason?.code).toBe('renderer-stalled');
    expect(win.loadFile).toHaveBeenCalledTimes(1);
  });

  it('keeps a healthy renderer open even when an image prevents did-finish-load', () => {
    win.start(); win.commit(); handleRendererReady();
    vi.advanceTimersByTime(60_000);
    expect(win.loadFile).not.toHaveBeenCalled();
    expect(recoveryStore.get().mode).toBe('normal');
  });

  it('does not rearm a deadline when did-finish-load arrives after rendererReady', () => {
    win.start(); win.commit(); handleRendererReady();
    win.webContents.emit('did-finish-load');
    vi.advanceTimersByTime(60_000);
    expect(win.loadFile).not.toHaveBeenCalled();
  });

  it('does not let subframes or same-document navigation postpone a stalled request', () => {
    win.start(); vi.advanceTimersByTime(15_000);
    win.webContents.emit('did-start-navigation', { url: 'https://example.com/', isMainFrame: false, isSameDocument: false });
    win.webContents.emit('did-start-navigation', { url: 'https://lumesocial.online/app/#other', isMainFrame: true, isSameDocument: true });
    vi.advanceTimersByTime(5_000);
    expect(recoveryStore.get().reason?.code).toBe('load-failed');
  });

  it('replaces the old deadline when a different top-level request starts', () => {
    win.start(); vi.advanceTimersByTime(15_000);
    win.start('https://lumesocial.online/app/login');
    // Chromium may report the previous cancelled navigation after the new start.
    win.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'https://lumesocial.online/app/', true);
    vi.advanceTimersByTime(5_000);
    expect(win.loadFile).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(win.loadFile).toHaveBeenCalledTimes(1);
  });

  it('clears the network deadline when navigating to the local recovery page', () => {
    win.start(); win.start('file:///Lume/resources/recovery.html');
    vi.advanceTimersByTime(60_000);
    expect(win.loadFile).not.toHaveBeenCalled();
  });

  it('reports a real network failure once and clears the pending deadline', () => {
    win.start();
    win.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://lumesocial.online/app/', true);
    expect(recoveryStore.get().reason?.detail).toContain('ERR_NAME_NOT_RESOLVED');
    vi.advanceTimersByTime(60_000);
    expect(win.loadFile).toHaveBeenCalledTimes(1);
    expect(recoveryStore.get().reason?.detail).toContain('ERR_NAME_NOT_RESOLVED');
  });

  it('clears pending timers when the window closes', () => {
    win.start(); win.destroyed = true; win.emit('closed');
    vi.advanceTimersByTime(60_000);
    expect(win.loadFile).not.toHaveBeenCalled();
  });

  it('supports the legacy navigation arguments while ignoring deadlines in development', () => {
    win.webContents.emit('did-start-navigation', {}, 'https://lumesocial.online/app/', false, true);
    vi.advanceTimersByTime(20_000);
    expect(win.loadFile).toHaveBeenCalledTimes(1);
    win.loadFile.mockClear(); recoveryStore.markRecoveryExited();
    electron.app.isPackaged = false;
    win.start(); vi.advanceTimersByTime(60_000);
    expect(win.loadFile).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createSnapshot, listSnapshots, pruneSnapshots, state } = vi.hoisted(() => ({
  createSnapshot: vi.fn(() => '/tmp/snap-scheduled.db'),
  listSnapshots: vi.fn((): Array<{ reason: string; mtimeMs: number }> => []),
  pruneSnapshots: vi.fn(),
  state: { disabled: false },
}));

vi.mock('./backup.js', () => ({ createSnapshot, listSnapshots, pruneSnapshots }));
vi.mock('../db/index.js', () => ({ getRawDb: () => ({}) }));
vi.mock('../config.js', () => ({
  config: { backup: { get disabled() { return state.disabled; }, intervalHours: 1 } },
}));

import { startBackupWorker, stopBackupWorker } from './backupWorker.js';

beforeEach(() => {
  vi.useFakeTimers();
  createSnapshot.mockClear();
  listSnapshots.mockReset();
  listSnapshots.mockReturnValue([]);
  pruneSnapshots.mockClear();
  state.disabled = false;
});
afterEach(() => { stopBackupWorker(); vi.useRealTimers(); });

describe('backupWorker', () => {
  it('snapshots on each interval tick', () => {
    startBackupWorker();
    vi.advanceTimersByTime(60 * 60 * 1000); // 1h
    expect(createSnapshot).toHaveBeenCalledWith(expect.anything(), 'scheduled');
    expect(pruneSnapshots).toHaveBeenCalledOnce();
  });

  it('does nothing when disabled', () => {
    state.disabled = true;
    startBackupWorker();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it('takes the first snapshot shortly after boot when none exists', () => {
    startBackupWorker();
    vi.advanceTimersByTime(29_999);
    expect(createSnapshot).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(createSnapshot).toHaveBeenCalledOnce();
  });

  it('does not duplicate a recent scheduled snapshot after a restart', () => {
    listSnapshots.mockReturnValue([{ reason: 'scheduled', mtimeMs: Date.now() - 10 * 60 * 1000 }]);
    startBackupWorker();
    vi.advanceTimersByTime(49 * 60 * 1000);
    expect(createSnapshot).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 1000);
    expect(createSnapshot).toHaveBeenCalledOnce();
  });
});

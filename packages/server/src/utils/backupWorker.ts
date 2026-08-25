import { config } from '../config.js';
import { getRawDb } from '../db/index.js';
import { createSnapshot, listSnapshots, pruneSnapshots } from './backup.js';

let timer: ReturnType<typeof setInterval> | null = null;

const STARTUP_GRACE_MS = 30_000;

function writeScheduledSnapshot(): void {
  try {
    const snap = createSnapshot(getRawDb(), 'scheduled');
    pruneSnapshots();
    console.log(`[backup] scheduled snapshot written: ${snap}`);
  } catch (err) {
    console.error(`[backup] scheduled snapshot failed: ${(err as Error).message}`);
  }
}

export function startBackupWorker(): void {
  if (config.backup.disabled) {
    console.log('[backup] scheduled worker disabled via BACKUP_DISABLED');
    return;
  }
  if (timer) return;
  const intervalMs = config.backup.intervalHours * 60 * 60 * 1000;
  const newestScheduled = listSnapshots().find((snapshot) => snapshot.reason === 'scheduled');
  const elapsedSinceLastSnapshot = newestScheduled ? Date.now() - newestScheduled.mtimeMs : intervalMs;
  const firstDelayMs = Math.max(STARTUP_GRACE_MS, intervalMs - elapsedSinceLastSnapshot);

  timer = setTimeout(() => {
    writeScheduledSnapshot();
    timer = setInterval(writeScheduledSnapshot, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }, firstDelayMs);
  // Do not keep the event loop alive solely for backups.
  if (typeof timer.unref === 'function') timer.unref();
  console.log(
    `[backup] scheduled worker started (every ${config.backup.intervalHours}h; next snapshot in ${Math.ceil(firstDelayMs / 1000)}s)`,
  );
}

export function stopBackupWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

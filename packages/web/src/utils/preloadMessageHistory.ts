interface HistoryLoader {
  loadInitial: (channelId: string) => Promise<void>;
  loadOlder: (channelId: string) => Promise<boolean>;
  hasOlder: (channelId: string) => boolean | undefined;
  isCurrent: () => boolean;
}

// Round-robin pages let every channel become usable before a long archive finishes.
// At most one background request starts every 500 ms, leaving room for normal use.
export async function preloadMessageHistory(
  channelIds: string[],
  loader: HistoryLoader,
  signal: AbortSignal,
  interval = 500,
): Promise<boolean> {
  const waiting = [...new Set(channelIds)];
  const older: string[] = [];
  let complete = true;
  let nextRequestAt = 0;
  const active = () => !signal.aborted && loader.isCurrent();
  const waitForTurn = async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, delay);
      signal.addEventListener('abort', finish, { once: true });
    });
    nextRequestAt = Date.now() + interval;
  };

  for (const channelId of waiting) {
    await waitForTurn();
    if (!active()) return false;
    await loader.loadInitial(channelId);
    if (!active()) return false;
    const hasOlder = loader.hasOlder(channelId);
    if (hasOlder === undefined) complete = false;
    else if (hasOlder) older.push(channelId);
  }
  while (older.length) {
    const channelId = older.shift()!;
    await waitForTurn();
    if (!active()) return false;
    const loaded = await loader.loadOlder(channelId);
    if (!active()) return false;
    if (loader.hasOlder(channelId)) {
      if (loaded) older.push(channelId);
      else complete = false;
    }
  }
  return complete;
}

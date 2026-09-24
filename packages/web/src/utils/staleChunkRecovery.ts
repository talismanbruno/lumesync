const RECOVERY_KEY = 'lume:stale-chunk-recovery';
const RECOVERY_COOLDOWN_MS = 30_000;

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|module script|javascript mime type|importing a module script failed|load failed/i.test(message);
}

export function canRecoverStaleChunk(storage: Storage, now = Date.now()): boolean {
  const previous = Number(storage.getItem(RECOVERY_KEY) ?? 0);
  if (Number.isFinite(previous) && now - previous < RECOVERY_COOLDOWN_MS) return false;
  storage.setItem(RECOVERY_KEY, String(now));
  return true;
}

async function resetAppCodeCache(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('workbox-precache') || name === 'lume-on-demand-assets')
      .map(name => caches.delete(name)));
  }
}

export async function recoverFromStaleChunk(error: unknown): Promise<boolean> {
  if (!isStaleChunkError(error) || !canRecoverStaleChunk(window.sessionStorage)) return false;

  try {
    await resetAppCodeCache();
  } catch (cacheError) {
    console.warn('[stale-chunk-recovery] Could not fully reset app caches', cacheError);
  }

  window.location.reload();
  return true;
}

export function installStaleChunkRecovery(): () => void {
  const handler = (event: Event) => {
    const preloadEvent = event as Event & { payload?: unknown };
    if (!isStaleChunkError(preloadEvent.payload)) return;
    event.preventDefault();
    void recoverFromStaleChunk(preloadEvent.payload);
  };

  window.addEventListener('vite:preloadError', handler);
  return () => window.removeEventListener('vite:preloadError', handler);
}

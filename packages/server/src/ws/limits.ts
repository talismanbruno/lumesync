export const MAX_WS_PAYLOAD_BYTES = 256 * 1024;

const WINDOW_MS = 60_000;
const MAX_CONNECTIONS_PER_WINDOW = 30;
const MAX_TRACKED_IPS = 10_000;
const attempts = new Map<string, { count: number; until: number }>();

export function allowWsConnection(ip: string, now = Date.now()): boolean {
  const current = attempts.get(ip);
  if (!current || current.until <= now) {
    if (attempts.size >= MAX_TRACKED_IPS) {
      for (const [key, value] of attempts) {
        if (value.until <= now) attempts.delete(key);
      }
      if (attempts.size >= MAX_TRACKED_IPS) return false;
    }
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_CONNECTIONS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export function wsPayloadBytes(data: Buffer | string): number {
  return typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.byteLength;
}

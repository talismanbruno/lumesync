import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { Activity } from '@backspace/shared';
import { config } from '../config.js';
import { getDb, schema } from '../db/index.js';
import { connectionManager } from '../ws/handler.js';
import { collectProfileBroadcastTargetIds } from './userDeletion.js';
import { queuePresenceRelay } from './federationPresence.js';

const key = () => createHash('sha256').update('lume.spotify.credentials.v1\0').update(config.jwtSecret).digest();
export function encryptSpotify(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function decryptSpotify<T>(value: string): T {
  const data = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8')) as T;
}
export const spotifyStateHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function spotifyRedirect(): string | null {
  try {
    const url = new URL(config.spotify.publicUrl ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !config.spotify.clientId) return null;
    return url.origin + '/app/connections/spotify/callback';
  } catch { return null; }
}
export interface SpotifyTokens { accessToken: string; refreshToken: string; }
class SpotifyAuthorizationError extends Error {}
let retryAt = 0;
export async function spotifyToken(body: URLSearchParams): Promise<{ tokens: SpotifyTokens; expiresAt: number }> {
  if (Date.now() < retryAt) throw new Error('Spotify está ocupado. Aguarde um pouco e tente novamente.');
  body.set('client_id', config.spotify.clientId ?? '');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(8000), redirect: 'error',
  });
  if (response.status === 429) retryAt = Date.now() + retryDelay(response);
  if (response.status === 400 || response.status === 401) throw new SpotifyAuthorizationError('Conecte sua conta novamente.');
  if (!response.ok) throw new Error('Não foi possível autorizar o Spotify. Conecte sua conta novamente.');
  const data = await response.json() as Record<string, unknown>;
  if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || Number(data.expires_in) <= 0) throw new Error('Resposta inválida do Spotify.');
  const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : body.get('refresh_token');
  if (!refreshToken) throw new Error('O Spotify não forneceu a autorização necessária.');
  return { tokens: { accessToken: data.access_token, refreshToken }, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
}
function retryDelay(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 24 * 3600_000) : 60_000;
}
export function spotifyActivity(data: unknown, now = Date.now()): Activity | null {
  if (!data || typeof data !== 'object') return null;
  const playback = data as { is_playing?: boolean; currently_playing_type?: string; item?: { name?: string; duration_ms?: number; artists?: { name?: string }[]; external_urls?: { spotify?: string } }; progress_ms?: number };
  const item = playback.item;
  if (playback.is_playing !== true || playback.currently_playing_type !== 'track' || !item || typeof item.name !== 'string') return null;
  const url = item.external_urls?.spotify;
  if (typeof url !== 'string' || !/^https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+$/.test(url)) return null;
  const remaining = Number(item.duration_ms) - Number(playback.progress_ms);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const artists = Array.isArray(item.artists) ? item.artists.filter(artist => typeof artist?.name === 'string').map(artist => artist.name).join(', ').slice(0, 128) : '';
  return { type: 'listening', name: 'Spotify', details: item.name.slice(0, 128), state: artists, url, timestamps: { end: now + Math.min(remaining, 60_000) } };
}
export function publishSpotify(userId: string, activity: Activity | null): void {
  const before = JSON.stringify(connectionManager.getUserActivities(userId));
  connectionManager.setSpotifyActivity(userId, activity);
  const activities = connectionManager.getUserActivities(userId);
  if (before === JSON.stringify(activities)) return;
  const status = connectionManager.getUserStatus(userId) as 'online' | 'working' | 'idle' | 'dnd' | 'offline';
  const payload = { type: 'presence_update' as const, userId, status, activities };
  const targets = collectProfileBroadcastTargetIds(userId);
  targets.add(userId);
  for (const target of targets) connectionManager.sendToUser(target, payload);
  queuePresenceRelay(userId, status, activities);
}
let running = false;
let interval: ReturnType<typeof setInterval> | undefined;
export async function pollSpotify(): Promise<void> {
  if (running || !spotifyRedirect()) return;
  running = true;
  try {
    const db = getDb();
    db.delete(schema.spotifyOauthStates).where(lt(schema.spotifyOauthStates.expiresAt, Date.now())).run();
    const connections = db.select().from(schema.spotifyConnections).all();
    for (const row of connections) {
      const user = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).get();
      if (!user || user.isDeleted || user.isSuspended || (user.passwordChangedAt ?? 0) !== row.passwordEpoch) {
        db.delete(schema.spotifyConnections).where(eq(schema.spotifyConnections.userId, row.userId)).run();
        publishSpotify(row.userId, null); continue;
      }
      if (!row.showListening || !user.showActivity || connectionManager.getUserStatus(row.userId) === 'offline' || Date.now() < retryAt) {
        publishSpotify(row.userId, null); continue;
      }
      try {
        let tokens = decryptSpotify<SpotifyTokens>(row.encryptedTokens);
        let expectedEncrypted = row.encryptedTokens;
        if (row.expiresAt < Date.now() + 30_000) {
          const fresh = await spotifyToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }));
          tokens = fresh.tokens;
          // Compare the original encrypted value so unlink/relink wins in-flight.
          expectedEncrypted = encryptSpotify(tokens);
          db.update(schema.spotifyConnections).set({ encryptedTokens: expectedEncrypted, expiresAt: fresh.expiresAt })
            .where(and(eq(schema.spotifyConnections.userId, row.userId), eq(schema.spotifyConnections.encryptedTokens, row.encryptedTokens))).run();
        }
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: 'Bearer ' + tokens.accessToken }, signal: AbortSignal.timeout(8000), redirect: 'error',
        });
        if (response.status === 429) retryAt = Date.now() + retryDelay(response);
        if (response.status === 401 || response.status === 403) {
          db.delete(schema.spotifyConnections).where(and(eq(schema.spotifyConnections.userId, row.userId), eq(schema.spotifyConnections.updatedAt, row.updatedAt))).run();
        }
        const current = db.select().from(schema.spotifyConnections).where(eq(schema.spotifyConnections.userId, row.userId)).get();
        const allowed = current?.showListening && current.encryptedTokens === expectedEncrypted && current.updatedAt === row.updatedAt && connectionManager.getUserShowActivity(row.userId) && connectionManager.getUserStatus(row.userId) !== 'offline';
        publishSpotify(row.userId, allowed && response.ok && response.status !== 204 ? spotifyActivity(await response.json()) : null);
      } catch (error) {
        if (error instanceof SpotifyAuthorizationError) db.delete(schema.spotifyConnections).where(and(eq(schema.spotifyConnections.userId, row.userId), eq(schema.spotifyConnections.updatedAt, row.updatedAt))).run();
        // Never log authorization responses/tokens, or retain a stale song after failure.
        publishSpotify(row.userId, null);
      }
    }
  } catch {
    console.warn('[spotify] Não foi possível atualizar as atividades nesta rodada.');
  } finally { running = false; }
}
export function startSpotifyWorker(): void {
  if (interval || !spotifyRedirect()) return;
  void pollSpotify();
  interval = setInterval(() => void pollSpotify(), 15_000);
  interval.unref();
}
export function stopSpotifyWorker(): void { if (interval) clearInterval(interval); interval = undefined; }

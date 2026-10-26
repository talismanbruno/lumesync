import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { signJwt } from '../utils/auth.js';
import { encryptSpotify, decryptSpotify, spotifyActivity, pollSpotify } from '../utils/spotify.js';
import type { Activity } from '@backspace/shared';

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let app: FastifyInstance;
const live = new Map<string, Activity>();
const mocks = vi.hoisted(() => ({ status: 'online', show: true, send: vi.fn(), relay: vi.fn() }));
vi.mock('../db/index.js', () => ({ getDb: () => testDb, schema }));
vi.mock('../utils/userDeletion.js', () => ({ collectProfileBroadcastTargetIds: () => new Set(['viewer']) }));
vi.mock('../utils/federationPresence.js', () => ({ queuePresenceRelay: mocks.relay }));
vi.mock('../ws/handler.js', () => ({ connectionManager: {
  getUserActivities: (id: string) => live.has(id) ? [live.get(id)!] : [],
  setSpotifyActivity: (id: string, activity: Activity | null) => { if (activity) live.set(id, activity); else live.delete(id); },
  getUserStatus: () => mocks.status, getUserShowActivity: () => mocks.show, sendToUser: mocks.send,
} }));
const auth = (id = 'alice') => ({ authorization: 'Bearer ' + signJwt({ userId: id, username: id }) });
const playback = { is_playing: true, currently_playing_type: 'track', progress_ms: 1000, item: { name: 'Uma música', duration_ms: 200_000, artists: [{ name: 'Artista' }], external_urls: { spotify: 'https://open.spotify.com/track/abc123' } } };
const fetchMock = vi.fn();
beforeEach(async () => {
  vi.clearAllMocks(); live.clear(); mocks.status = 'online'; mocks.show = true;
  Object.assign(config.spotify, { clientId: 'public-client', publicUrl: 'https://lume.test' });
  vi.stubGlobal('fetch', fetchMock);
  sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys = ON');
  const folder = fileURLToPath(new URL('../../drizzle/', import.meta.url));
  for (const file of readdirSync(folder).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(folder + '/' + file, 'utf8').replaceAll('--> statement-breakpoint', ''));
  testDb = drizzle(sqlite, { schema });
  for (const id of ['alice', 'bob']) testDb.insert(schema.users).values({ id, username: id, passwordHash: 'unused', createdAt: 1 }).run();
  app = Fastify();
  const { spotifyRoutes } = await import('./spotify.js');
  await app.register(spotifyRoutes); await app.ready();
});
afterEach(async () => { await app.close(); sqlite.close(); vi.unstubAllGlobals(); });
async function start() {
  const result = await app.inject({ method: 'POST', url: '/api/connections/spotify/start', headers: auth() });
  expect(result.statusCode).toBe(200);
  const url = new URL(result.json().url);
  return { url, state: url.searchParams.get('state')! };
}
function complete(state: string, id = 'alice') {
  return app.inject({ method: 'POST', url: '/api/connections/spotify/complete', headers: auth(id), payload: { state, code: 'authorization-code' } });
}
function connect() {
  testDb.insert(schema.spotifyConnections).values({ userId: 'alice', encryptedTokens: encryptSpotify({ accessToken: 'private-access', refreshToken: 'private-refresh' }), expiresAt: Date.now() + 3600_000, passwordEpoch: 0, updatedAt: 1 }).run();
}
describe('Spotify account connection', () => {
  it('requires a Lume session and reports an unconfigured provider honestly', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/connections/spotify' })).statusCode).toBe(401);
    Object.assign(config.spotify, { clientId: undefined });
    expect((await app.inject({ method: 'GET', url: '/api/connections/spotify', headers: auth() })).json()).toEqual({ available: false, connected: false, showListening: false });
    expect((await app.inject({ method: 'POST', url: '/api/connections/spotify/start', headers: auth() })).statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses S256 PKCE, a fixed redirect, minimum scope and encrypted single-use state', async () => {
    const { url, state } = await start();
    const row = testDb.select().from(schema.spotifyOauthStates).get()!;
    const verifier = decryptSpotify<string>(row.encryptedVerifier);
    expect(row.stateHash).not.toBe(state);
    expect(row.encryptedVerifier).not.toContain(verifier);
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('user-read-currently-playing');
    expect(url.searchParams.get('redirect_uri')).toBe('https://lume.test/app/connections/spotify/callback');
  });
  it('rejects another Lume account, expires state and cannot replay a completed code', async () => {
    const { state } = await start();
    expect((await complete(state, 'bob')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 }), { status: 200 }));
    expect((await complete(state)).statusCode).toBe(200);
    expect((await complete(state)).statusCode).toBe(400);
    const row = testDb.select().from(schema.spotifyConnections).get()!;
    expect(row.encryptedTokens).not.toContain('private-access');
    const status = await app.inject({ method: 'GET', url: '/api/connections/spotify', headers: auth() });
    expect(status.body).not.toMatch(/private-access|private-refresh|encryptedTokens/);
    const fresh = await start();
    testDb.update(schema.spotifyOauthStates).set({ expiresAt: Date.now() - 1 }).run();
    expect((await complete(fresh.state)).statusCode).toBe(400);
  });
  it('invalidates pending authorizations on password change', async () => {
    const { state } = await start();
    testDb.update(schema.users).set({ passwordChangedAt: Date.now() - 1000 }).where(eq(schema.users.id, 'alice')).run();
    expect((await complete(state)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('updates listening metadata and clears it on pause or empty playback', async () => {
    connect();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(playback)));
    await pollSpotify();
    expect(live.get('alice')?.details).toBe('Uma música');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...playback, is_playing: false })));
    await pollSpotify(); expect(live.has('alice')).toBe(false);
    live.set('alice', spotifyActivity(playback)!);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await pollSpotify(); expect(live.has('alice')).toBe(false);
  });
  it('does not fetch or publish listening while invisible, disabled or unlinked', async () => {
    connect(); live.set('alice', spotifyActivity(playback)!);
    mocks.status = 'offline'; await pollSpotify();
    expect(live.size).toBe(0); expect(fetchMock).not.toHaveBeenCalled();
    mocks.status = 'online';
    await app.inject({ method: 'PATCH', url: '/api/connections/spotify', headers: auth(), payload: { showListening: false } });
    await pollSpotify(); expect(fetchMock).not.toHaveBeenCalled();
    await app.inject({ method: 'DELETE', url: '/api/connections/spotify', headers: auth() });
    expect(testDb.select().from(schema.spotifyConnections).all()).toEqual([]);
  });
  it('does not restore music when disconnect wins an in-flight request', async () => {
    connect();
    let respond!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { respond = resolve; }));
    const polling = pollSpotify();
    await app.inject({ method: 'DELETE', url: '/api/connections/spotify', headers: auth() });
    respond(new Response(JSON.stringify(playback)));
    await polling; expect(live.has('alice')).toBe(false);
  });
  it('rejects tampered credentials and non-track/invalid playback metadata', () => {
    const encrypted = encryptSpotify({ token: 'secret' });
    expect(() => decryptSpotify(encrypted.slice(0, -8) + 'AAAAAAAA')).toThrow();
    expect(spotifyActivity({ ...playback, currently_playing_type: 'ad' })).toBeNull();
    expect(spotifyActivity({ ...playback, item: { ...playback.item, external_urls: { spotify: 'javascript:alert(1)' } } })).toBeNull();
    expect(spotifyActivity({ ...playback, progress_ms: Infinity })).toBeNull();
  });
});

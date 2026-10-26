import type { FastifyInstance } from 'fastify';
import { and, eq, lt } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { config } from '../config.js';
import { encryptSpotify, decryptSpotify, spotifyRedirect, spotifyStateHash, spotifyToken, publishSpotify, pollSpotify } from '../utils/spotify.js';

export async function spotifyRoutes(app: FastifyInstance): Promise<void> {
  const options = { preHandler: authenticate };
  app.get('/api/connections/spotify', options, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const row = getDb().select().from(schema.spotifyConnections).where(eq(schema.spotifyConnections.userId, request.userId)).get();
    return { available: !!spotifyRedirect(), connected: !!row, showListening: !!row?.showListening };
  });
  app.post('/api/connections/spotify/start', { ...options, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    const redirect = spotifyRedirect();
    if (!redirect) return reply.code(503).send({ error: 'A conexão de música do Spotify ainda não foi habilitada no Lume.' });
    const db = getDb();
    const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get()!;
    if (user.homeInstance && !user.federationHomeOrphaned) return reply.code(403).send({ error: 'Conecte o Spotify na sua instância de origem.' });
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    db.delete(schema.spotifyOauthStates).where(lt(schema.spotifyOauthStates.expiresAt, Date.now())).run();
    db.delete(schema.spotifyOauthStates).where(eq(schema.spotifyOauthStates.userId, user.id)).run();
    db.insert(schema.spotifyOauthStates).values({ stateHash: spotifyStateHash(state), userId: user.id, encryptedVerifier: encryptSpotify(verifier), expiresAt: Date.now() + 10 * 60_000, passwordEpoch: user.passwordChangedAt ?? 0 }).run();
    const params = new URLSearchParams({ client_id: config.spotify.clientId!, response_type: 'code', redirect_uri: redirect, scope: 'user-read-currently-playing', state, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
    reply.header('Cache-Control', 'no-store');
    return { url: 'https://accounts.spotify.com/authorize?' + params };
  });
  app.post<{ Body: { code?: unknown; state?: unknown } }>('/api/connections/spotify/complete', options, async (request, reply) => {
    const redirect = spotifyRedirect();
    const { code, state } = request.body ?? {};
    if (!redirect || typeof code !== 'string' || code.length > 2048 || !code || typeof state !== 'string' || !/^[\w-]{43}$/.test(state)) return reply.code(400).send({ error: 'Esta autorização está incompleta ou expirou. Conecte o Spotify novamente.' });
    const db = getDb();
    const hash = spotifyStateHash(state);
    // Match the logged-in Lume account before consuming anything: system-browser
    // OAuth callbacks do not share the desktop application's session.
    const pending = db.select().from(schema.spotifyOauthStates).where(and(eq(schema.spotifyOauthStates.stateHash, hash), eq(schema.spotifyOauthStates.userId, request.userId))).get();
    const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get()!;
    if (!pending || pending.expiresAt <= Date.now() || pending.passwordEpoch !== (user.passwordChangedAt ?? 0)) return reply.code(400).send({ error: 'Entre na mesma conta Lume que iniciou a conexão, ou conecte o Spotify novamente.' });
    const consumed = db.delete(schema.spotifyOauthStates).where(and(eq(schema.spotifyOauthStates.stateHash, hash), eq(schema.spotifyOauthStates.userId, request.userId))).run();
    if (!consumed.changes) return reply.code(400).send({ error: 'Esta autorização já foi utilizada.' });
    try {
      const result = await spotifyToken(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: decryptSpotify<string>(pending.encryptedVerifier) }));
      const current = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
      if (!current || current.isDeleted || current.isSuspended || (current.passwordChangedAt ?? 0) !== pending.passwordEpoch) return reply.code(401).send({ error: 'Sua sessão mudou. Entre novamente para conectar o Spotify.' });
      db.insert(schema.spotifyConnections).values({ userId: user.id, encryptedTokens: encryptSpotify(result.tokens), expiresAt: result.expiresAt, passwordEpoch: pending.passwordEpoch, updatedAt: Date.now(), showListening: 1 })
        .onConflictDoUpdate({ target: schema.spotifyConnections.userId, set: { encryptedTokens: encryptSpotify(result.tokens), expiresAt: result.expiresAt, passwordEpoch: pending.passwordEpoch, updatedAt: Date.now(), showListening: 1 } }).run();
      reply.header('Cache-Control', 'no-store');
      void pollSpotify();
      return { success: true };
    } catch { return reply.code(502).send({ error: 'O Spotify não concluiu a autorização. Volte às conexões e tente novamente.' }); }
  });
  app.patch<{ Body: { showListening?: unknown } }>('/api/connections/spotify', options, async (request, reply) => {
    if (typeof request.body?.showListening !== 'boolean') return reply.code(400).send({ error: 'Escolha se deseja exibir a música.' });
    getDb().update(schema.spotifyConnections).set({ showListening: request.body.showListening ? 1 : 0, updatedAt: Date.now() }).where(eq(schema.spotifyConnections.userId, request.userId)).run();
    if (!request.body.showListening) publishSpotify(request.userId, null);
    else void pollSpotify();
    return { success: true };
  });
  app.delete('/api/connections/spotify', options, async request => {
    const db = getDb();
    db.delete(schema.spotifyConnections).where(eq(schema.spotifyConnections.userId, request.userId)).run();
    db.delete(schema.spotifyOauthStates).where(eq(schema.spotifyOauthStates.userId, request.userId)).run();
    publishSpotify(request.userId, null);
    return { success: true };
  });
}

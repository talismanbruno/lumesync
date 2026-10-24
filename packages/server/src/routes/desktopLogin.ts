import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, setMediaAuthCookie, signJwt } from '../utils/auth.js';
import { sanitizeUser } from '../utils/sanitize.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const challengeFor = (value: string) => createHash('sha256').update(value).digest('base64url');
const isChallenge = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const isVerifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value);

/** Native-app authorization code handoff; never exposes a session token in a URL. */
export async function desktopLoginRoutes(app: FastifyInstance) {
  // Short-lived grants belong to this server process. A restart invalidates
  // pending handoffs; no browser session or password is retained here.
  const grants = new Map<string, { challenge: string; userId: string; epoch: number; expiresAt: number }>();
  const prune = () => {
    for (const [key, grant] of grants) if (grant.expiresAt <= Date.now()) grants.delete(key);
  };
  app.addHook('onClose', async () => { grants.clear(); });

  app.post<{ Body: { challenge?: unknown } }>('/api/auth/desktop/authorize', {
    preHandler: authenticate,
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!isChallenge(request.body?.challenge)) return reply.code(400).send({ error: 'Solicitação inválida. Inicie novamente pelo aplicativo.' });
    prune();
    if (grants.size >= 2000) return reply.code(503).send({ error: 'Tente novamente em instantes.' });
    const user = getDb().select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
    if (!user || user.isDeleted || user.isSuspended) return reply.code(401).send({ error: 'Entre novamente na sua conta.' });
    const code = randomBytes(32).toString('hex');
    grants.set(hash(code), { challenge: request.body.challenge, userId: user.id, epoch: user.passwordChangedAt ?? 0, expiresAt: Date.now() + 60_000 });
    return { code };
  });

  app.post<{ Body: { code?: unknown; verifier?: unknown } }>('/api/auth/desktop/exchange', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { code, verifier } = request.body ?? {};
    const invalid = () => reply.code(400).send({ error: 'Solicitação expirada ou inválida. Inicie novamente pelo aplicativo.' });
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code) || !isVerifier(verifier)) return invalid();
    prune();
    const key = hash(code);
    const grant = grants.get(key);
    if (!grant || !timingSafeEqual(Buffer.from(grant.challenge), Buffer.from(challengeFor(verifier)))) return invalid();
    // Consume synchronously before issuing a token: replay and concurrent
    // exchanges cannot mint additional sessions from the same authorization.
    grants.delete(key);
    const user = getDb().select().from(schema.users).where(eq(schema.users.id, grant.userId)).get();
    if (!user || user.isDeleted || user.isSuspended || (user.passwordChangedAt ?? 0) !== grant.epoch) return invalid();
    const token = signJwt({ userId: user.id, username: user.username });
    setMediaAuthCookie(reply, token);
    return { token, user: sanitizeUser(user, true) };
  });
}

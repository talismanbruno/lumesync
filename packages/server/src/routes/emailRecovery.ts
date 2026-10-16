import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, clearMediaAuthCookie, hashPassword, verifyPassword } from '../utils/auth.js';
import { emailDeliveryReady, hashEmailToken, normalizeEmail, sendAccountEmail, setPendingEmail } from '../utils/accountEmail.js';

const unavailable = 'O envio de e-mails ainda não está disponível. Tente novamente mais tarde.';
const invalid = 'Este link é inválido ou expirou. Solicite um novo link.';
const rateLimit = { max: 5, timeWindow: '15 minutes' };

export async function emailRecoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/email-status', async (_request, reply) =>
    reply.header('Cache-Control', 'no-store').send({ available: emailDeliveryReady() }));

  app.get('/api/auth/recovery-email', { preHandler: authenticate }, async (request, reply) => {
    const account = getDb().select().from(schema.accountEmails).where(eq(schema.accountEmails.userId, request.userId)).get();
    return reply.header('Cache-Control', 'no-store').send({
      email: account?.email ?? null, pendingEmail: account?.pendingEmail ?? null,
      verified: !!account?.email, available: emailDeliveryReady(),
    });
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>('/api/auth/recovery-email', {
    preHandler: authenticate, config: { rateLimit },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password;
    if (!email || typeof password !== 'string' || !password || password.length > 1024)
      return reply.code(400).send({ error: 'Informe um e-mail válido e sua senha atual.' });
    const user = getDb().select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
    if (!user || user.homeInstance) return reply.code(400).send({ error: 'Gerencie a recuperação na instância de origem da conta.' });
    if (!await verifyPassword(password, user.passwordHash)) return reply.code(403).send({ error: 'A senha atual está incorreta.' });
    setPendingEmail(user.id, email);
    if (!emailDeliveryReady()) return reply.send({ success: true, sent: false });
    try {
      const sent = await sendAccountEmail(user.id, email, 'verify');
      return reply.send({ success: true, sent });
    } catch { return reply.code(503).send({ error: 'Não foi possível enviar a confirmação. Tente novamente mais tarde.' }); }
  });

  app.post<{ Body: { token?: unknown } }>('/api/auth/verify-email', { config: { rateLimit: { max: 15, timeWindow: '15 minutes' } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const token = request.body?.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return reply.code(400).send({ error: invalid });
    const db = getDb();
    const success = db.transaction(tx => {
      const row = tx.select().from(schema.accountEmailTokens).where(eq(schema.accountEmailTokens.tokenHash, hashEmailToken(token))).get();
      if (!row || row.purpose !== 'verify' || row.expiresAt <= Date.now()) return false;
      const user = tx.select().from(schema.users).where(eq(schema.users.id, row.userId)).get();
      const account = tx.select().from(schema.accountEmails).where(eq(schema.accountEmails.userId, row.userId)).get();
      if (!user || user.isDeleted || user.isSuspended || user.homeInstance || (user.passwordChangedAt ?? 0) !== row.passwordEpoch || account?.pendingEmail !== row.email) return false;
      const owner = tx.select().from(schema.accountEmails).where(eq(schema.accountEmails.email, row.email)).get();
      if (owner && owner.userId !== row.userId) return false;
      tx.update(schema.accountEmails).set({ email: row.email, pendingEmail: null, verifiedAt: Date.now() }).where(eq(schema.accountEmails.userId, row.userId)).run();
      tx.delete(schema.accountEmailTokens).where(and(eq(schema.accountEmailTokens.userId, row.userId), eq(schema.accountEmailTokens.purpose, 'verify'))).run();
      return true;
    });
    return success ? reply.send({ success: true }) : reply.code(400).send({ error: invalid });
  });

  app.post<{ Body: { email?: unknown } }>('/api/auth/forgot-password', { config: { rateLimit } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const email = normalizeEmail(request.body?.email);
    if (!email) return reply.code(400).send({ error: 'Informe um e-mail válido.' });
    if (!emailDeliveryReady()) return reply.code(503).send({ error: unavailable });
    // Identical response and asynchronous delivery for registered and unknown addresses.
    // The per-account cooldown lives in the database, alongside the per-IP route limit.
    setImmediate(() => {
      const account = getDb().select().from(schema.accountEmails).where(eq(schema.accountEmails.email, email)).get();
      if (account) void sendAccountEmail(account.userId, email, 'reset').catch(() => app.log.warn('Password recovery delivery failed'));
    });
    return reply.code(202).send({ success: true });
  });

  app.post<{ Body: { token?: unknown; newPassword?: unknown } }>('/api/auth/reset-password', { config: { rateLimit } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { token, newPassword } = request.body ?? {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return reply.code(400).send({ error: invalid });
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024)
      return reply.code(400).send({ error: 'A senha deve ter de 8 a 1.024 caracteres.' });
    const db = getDb();
    const tokenHash = hashEmailToken(token);
    const initial = db.select().from(schema.accountEmailTokens).where(eq(schema.accountEmailTokens.tokenHash, tokenHash)).get();
    if (!initial || initial.purpose !== 'reset' || initial.expiresAt <= Date.now()) return reply.code(400).send({ error: invalid });
    const passwordHash = await hashPassword(newPassword);
    const success = db.transaction(tx => {
      const row = tx.select().from(schema.accountEmailTokens).where(eq(schema.accountEmailTokens.tokenHash, tokenHash)).get();
      if (!row || row.purpose !== 'reset' || row.expiresAt <= Date.now()) return false;
      const user = tx.select().from(schema.users).where(eq(schema.users.id, row.userId)).get();
      const account = tx.select().from(schema.accountEmails).where(eq(schema.accountEmails.userId, row.userId)).get();
      if (!user || user.isDeleted || user.isSuspended || user.homeInstance || account?.email !== row.email || (user.passwordChangedAt ?? 0) !== row.passwordEpoch) return false;
      tx.update(schema.users).set({ passwordHash, passwordChangedAt: Math.ceil(Date.now() / 1000) * 1000 }).where(eq(schema.users.id, row.userId)).run();
      tx.delete(schema.accountEmailTokens).where(eq(schema.accountEmailTokens.userId, row.userId)).run();
      tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, row.userId)).run();
      return true;
    });
    if (!success) return reply.code(400).send({ error: invalid });
    clearMediaAuthCookie(reply);
    return reply.send({ success: true });
  });
}

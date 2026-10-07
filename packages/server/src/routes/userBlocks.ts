import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate } from '../utils/auth.js';
import { blockedIdentityKey } from '../utils/userBlocks.js';
import { sanitizeUser } from '../utils/sanitize.js';

export async function userBlockRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.get('/api/social/blocks', async request => {
    return getDb().select({ user: schema.users }).from(schema.userBlocks)
      .innerJoin(schema.users, eq(schema.users.id, schema.userBlocks.targetUserId))
      .where(eq(schema.userBlocks.userId, request.userId)).all().map(row => sanitizeUser(row.user));
  });
  app.put<{ Params: { userId: string } }>('/api/social/blocks/:userId', async (request, reply) => {
    const db = getDb();
    const target = db.select().from(schema.users).where(eq(schema.users.id, request.params.userId)).get();
    if (!target || target.isDeleted) return reply.code(404).send({ error: 'Usuário não encontrado', statusCode: 404 });
    const self = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
    if (!self || blockedIdentityKey(target) === blockedIdentityKey(self)) return reply.code(400).send({ error: 'Você não pode bloquear a própria conta', statusCode: 400 });
    db.insert(schema.userBlocks).values({ userId: request.userId, targetKey: blockedIdentityKey(target), targetUserId: target.id, createdAt: Date.now() }).onConflictDoNothing().run();
    return { success: true };
  });
  app.delete<{ Params: { userId: string } }>('/api/social/blocks/:userId', async (request, reply) => {
    const db = getDb();
    const target = db.select().from(schema.users).where(eq(schema.users.id, request.params.userId)).get();
    if (!target) return reply.code(404).send({ error: 'Usuário não encontrado', statusCode: 404 });
    db.delete(schema.userBlocks).where(and(eq(schema.userBlocks.userId, request.userId), eq(schema.userBlocks.targetKey, blockedIdentityKey(target)))).run();
    return { success: true };
  });
}

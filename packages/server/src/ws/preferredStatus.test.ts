import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { User, UserStatus } from '@backspace/shared';
import * as schema from '../db/schema.js';
import { signJwt } from '../utils/auth.js';
import { setWorkerId } from '../utils/snowflake.js';
import { sanitizeUser } from '../utils/sanitize.js';

setWorkerId(24);
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let app: FastifyInstance;
vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
const id = 'presence-preference-test';
const token = () => signJwt({ userId: id, username: 'presence_test' });
const row = () => db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;

async function connect() {
  const ws = await app.injectWS('/ws');
  const ready = once(ws, 'message');
  ws.send(JSON.stringify({ type: 'auth', token: token() }));
  const [raw] = await ready;
  const event = JSON.parse(raw.toString()) as { type: string; user: User };
  expect(event.type).toBe('ready');
  return { ws, user: event.user };
}

beforeEach(async () => {
  sqlite = new Database(':memory:');
  for (const file of fs.readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrations, file), 'utf8'));
  }
  db = drizzle(sqlite, { schema });
  db.insert(schema.users).values({ id, username: 'presence_test', passwordHash: 'test', createdAt: Date.now() }).run();
  const { registerWebSocket } = await import('./handler.js');
  const { userRoutes } = await import('../routes/users.js');
  app = Fastify();
  await app.register(websocket);
  await app.register(userRoutes);
  await registerWebSocket(app);
  await app.ready();
});

afterEach(async () => {
  vi.useRealTimers();
  const { connectionManager } = await import('./handler.js');
  await app.close();
  connectionManager.forceDisconnectUser(id);
  sqlite.close();
});

describe('saved manual presence', () => {
  it.each(['online', 'idle', 'dnd', 'offline', 'working'] as UserStatus[])('restores %s after disconnect cleanup and a fresh authenticated connection', async status => {
    if (status === 'working') db.update(schema.users).set({ isAdmin: 1 }).where(eq(schema.users.id, id)).run();
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: { authorization: `Bearer ${token()}` }, payload: { status } });
    expect(response.statusCode).toBe(200);
    expect(row().preferredStatus).toBe(status);
    const first = await connect();
    expect(first.user.status).toBe(status);
    expect(first.user.preferredStatus).toBe(status);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const closed = once(first.ws, 'close');
    first.ws.terminate();
    await closed;
    await vi.advanceTimersByTimeAsync(6000);
    expect(row().status).toBe('offline');
    expect(row().preferredStatus).toBe(status);
    vi.useRealTimers();
    const second = await connect();
    expect(second.user.status).toBe(status);
    expect(second.user.preferredStatus).toBe(status);
  });

  it('persists a manual socket change and reflects it in another connected tab', async () => {
    const first = await connect();
    const second = await connect();
    const updated = once(second.ws, 'message');
    first.ws.send(JSON.stringify({ type: 'presence_update', status: 'offline' }));
    const [raw] = await updated;
    expect(JSON.parse(raw.toString())).toMatchObject({ type: 'presence_update', userId: id, status: 'offline' });
    expect(row().preferredStatus).toBe('offline');
    expect((await connect()).user.status).toBe('offline');
  });

  it('keeps the preference private to self-view', () => {
    db.update(schema.users).set({ preferredStatus: 'dnd', status: 'offline' }).where(eq(schema.users.id, id)).run();
    expect(sanitizeUser(row(), true).preferredStatus).toBe('dnd');
    expect(sanitizeUser(row()).preferredStatus).toBeUndefined();
  });

  it('rejects Working for a non-admin without changing the saved preference', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: { authorization: `Bearer ${token()}` }, payload: { status: 'working' } });
    expect(response.statusCode).toBe(403);
    expect(row().preferredStatus).toBe('online');
  });
});

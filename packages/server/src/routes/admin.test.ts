import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { signJwt } from '../utils/auth.js';

setWorkerId(11);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let app: FastifyInstance;
let tusTmpDir: string;

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../config.js', async () => {
  const real = await import('../config.js');
  return {
    config: new Proxy(real.config, {
      get(target, prop: string) {
        if (prop === 'tusUploadDir') return tusTmpDir;
        return (target as Record<string, unknown>)[prop];
      },
    }),
  };
});

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    const statements = sqlText.split(/-->\s*statement-breakpoint/);
    for (const stmt of statements) {
      const clean = stmt.trim();
      if (clean) db.exec(clean);
    }
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const { adminRoutes } = await import('./admin.js');
  const f = Fastify();
  await f.register(adminRoutes);
  return f;
}

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';
const ADMIN_USERNAME = 'admin';
const USER_USERNAME = 'normie';

beforeEach(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  testDb = drizzle(sqlite, { schema });

  testDb.insert(schema.users).values([
    {
      id: ADMIN_ID,
      username: ADMIN_USERNAME,
      passwordHash: 'x',
      isAdmin: 1,
      createdAt: Date.now(),
    },
    {
      id: USER_ID,
      username: USER_USERNAME,
      passwordHash: 'x',
      isAdmin: 0,
      createdAt: Date.now(),
    },
  ]).run();

  tusTmpDir = path.join(os.tmpdir(), `backspace-admin-tus-${crypto.randomBytes(8).toString('hex')}`);
  app = await buildApp();
});

afterEach(() => {
  if (fs.existsSync(tusTmpDir)) {
    fs.rmSync(tusTmpDir, { recursive: true, force: true });
  }
});

function adminToken(): string {
  return signJwt({ userId: ADMIN_ID, username: ADMIN_USERNAME });
}

function userToken(): string {
  return signJwt({ userId: USER_ID, username: USER_USERNAME });
}

describe('beta contributor recognition', () => {
  const url = '/api/admin/users/user-1/beta-contributor';
  it('requires authentication and administrator privileges', async () => {
    expect((await app.inject({ method: 'PATCH', url, payload: { isBetaContributor: true } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url, headers: { authorization: `Bearer ${userToken()}` }, payload: { isBetaContributor: true } })).statusCode).toBe(403);
    expect(sqlite.prepare('SELECT is_beta_contributor FROM users WHERE id = ?').get(USER_ID)).toEqual({ is_beta_contributor: 0 });
  });
  it('grants and revokes persistently without changing roles or pioneer recognition', async () => {
    const { connectionManager } = await import('../ws/handler.js');
    const send = vi.spyOn(connectionManager, 'sendToUser');
    for (const enabled of [true, true, false]) {
      const response = await app.inject({ method: 'PATCH', url, headers: { authorization: `Bearer ${adminToken()}` }, payload: { isBetaContributor: enabled } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: USER_ID, isBetaContributor: enabled, isAdmin: false });
      expect(sqlite.prepare('SELECT is_beta_contributor, is_admin, is_pioneer FROM users WHERE id = ?').get(USER_ID))
        .toEqual({ is_beta_contributor: Number(enabled), is_admin: 0, is_pioneer: 0 });
      expect(send).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ type: 'user_updated', user: expect.objectContaining({ isBetaContributor: enabled }) }));
      const list = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { authorization: `Bearer ${adminToken()}` } });
      expect(list.json().users.find((u: { id: string }) => u.id === USER_ID).isBetaContributor).toBe(enabled);
    }
    send.mockRestore();
  });
  it.each([{}, { isBetaContributor: 'true' }, { isBetaContributor: 1 }, { isBetaContributor: null }])('rejects invalid values %j', async (payload) => {
    const response = await app.inject({ method: 'PATCH', url, headers: { authorization: `Bearer ${adminToken()}` }, payload });
    expect(response.statusCode).toBe(400);
  });
  it('rejects unknown, deleted and federated accounts', async () => {
    const headers = { authorization: `Bearer ${adminToken()}` };
    const payload = { isBetaContributor: true };
    expect((await app.inject({ method: 'PATCH', url: '/api/admin/users/missing/beta-contributor', headers, payload })).statusCode).toBe(404);
    sqlite.prepare('UPDATE users SET is_deleted = 1 WHERE id = ?').run(USER_ID);
    expect((await app.inject({ method: 'PATCH', url, headers, payload })).statusCode).toBe(404);
    sqlite.prepare("UPDATE users SET is_deleted = 0, home_instance = 'https://other.example' WHERE id = ?").run(USER_ID);
    expect((await app.inject({ method: 'PATCH', url, headers, payload })).statusCode).toBe(400);
  });
  it('hides recognition on deleted profiles', async () => {
    const { sanitizeUser } = await import('../utils/sanitize.js');
    sqlite.prepare('UPDATE users SET is_deleted = 1, is_beta_contributor = 1 WHERE id = ?').run(USER_ID);
    const row = testDb.select().from(schema.users).all().find(u => u.id === USER_ID)!;
    expect(sanitizeUser(row).isBetaContributor).toBe(false);
  });
  it('cannot be self-awarded through normal profile editing', async () => {
    const { userRoutes } = await import('./users.js');
    await app.register(userRoutes);
    const response = await app.inject({
      method: 'PATCH', url: '/api/users/@me',
      headers: { authorization: `Bearer ${userToken()}` },
      payload: { displayName: 'Still a normal user', isBetaContributor: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().isBetaContributor).toBe(false);
    expect(sqlite.prepare('SELECT is_beta_contributor FROM users WHERE id = ?').get(USER_ID)).toEqual({ is_beta_contributor: 0 });
  });
});

describe('POST /api/admin/storage/cleanup-tus', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      payload: { maxAgeHours: 1, dryRun: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-admin requests with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${userToken()}` },
      payload: { maxAgeHours: 1, dryRun: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when maxAgeHours is zero', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: 0, dryRun: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when maxAgeHours is negative', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: -3, dryRun: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when maxAgeHours is NaN/non-finite', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: 'banana', dryRun: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns CleanupResult shape with zeros when .tus/ is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: 1, dryRun: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      dryRun: false,
      deletedFiles: 0,
      freedBytes: 0,
      deletedAttachmentRecords: 0,
      errors: [],
    });
  });

  it('dryRun=true returns counts without unlinking', async () => {
    fs.mkdirSync(tusTmpDir, { recursive: true });
    const stale = path.join(tusTmpDir, 'stale-session');
    fs.writeFileSync(stale, 'x'.repeat(64));
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    fs.utimesSync(stale, twoHoursAgo / 1000, twoHoursAgo / 1000);

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: 1, dryRun: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dryRun).toBe(true);
    expect(body.deletedFiles).toBe(1);
    expect(body.freedBytes).toBe(64);
    expect(fs.existsSync(stale)).toBe(true);
  });

  it('dryRun=false unlinks stale entries', async () => {
    fs.mkdirSync(tusTmpDir, { recursive: true });
    const stale = path.join(tusTmpDir, 'stale-session');
    fs.writeFileSync(stale, 'y'.repeat(128));
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    fs.utimesSync(stale, threeHoursAgo / 1000, threeHoursAgo / 1000);

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { maxAgeHours: 1, dryRun: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dryRun).toBe(false);
    expect(body.deletedFiles).toBe(1);
    expect(body.freedBytes).toBe(128);
    expect(fs.existsSync(stale)).toBe(false);
  });

  it('defaults maxAgeHours to 1 when omitted', async () => {
    fs.mkdirSync(tusTmpDir, { recursive: true });
    const stale = path.join(tusTmpDir, 'stale-90min');
    fs.writeFileSync(stale, 'z'.repeat(32));
    const ninetyMinAgo = Date.now() - 90 * 60 * 1000;
    fs.utimesSync(stale, ninetyMinAgo / 1000, ninetyMinAgo / 1000);

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/storage/cleanup-tus',
      headers: { Authorization: `Bearer ${adminToken()}` },
      payload: { dryRun: true },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deletedFiles).toBe(1);
  });
});

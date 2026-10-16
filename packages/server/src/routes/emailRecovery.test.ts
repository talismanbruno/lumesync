import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';

const mail = vi.hoisted(() => ({ publicUrl: 'http://localhost:5193', previewDir: undefined as string | undefined, resendApiKey: undefined as string | undefined, from: undefined as string | undefined }));
vi.mock('../config.js', async importOriginal => {
  const original = await importOriginal<typeof import('../config.js')>();
  return { config: { ...original.config, mail } };
});
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
import { emailRecoveryRoutes } from './emailRecovery.js';
import { hashPassword, signJwt, verifyJwtAndUser, verifyPassword } from '../utils/auth.js';
import { emailDeliveryReady, hashEmailToken, sendAccountEmail } from '../utils/accountEmail.js';

let app: ReturnType<typeof Fastify>;
let outbox: string;
let authorization: string;
const originalPassword = 'initial-long-test-password';
async function settleMail() {
  await vi.waitFor(() => expect(db.select().from(schema.accountEmailTokens).all().some(row => row.purpose === 'reset')).toBe(true));
  await vi.waitFor(() => expect(readdirSync(outbox).some(name => readFileSync(join(outbox, name), 'utf8').includes('/reset-password#'))).toBe(true));
}
function deliveredToken(purpose: 'verify' | 'reset') {
  const messages = readdirSync(outbox).map(name => JSON.parse(readFileSync(join(outbox, name), 'utf8')));
  const message = messages.find(message => message.url.includes(purpose === 'verify' ? '/verify-email#' : '/reset-password#'));
  return new URLSearchParams(new URL(message.url).hash.slice(1)).get('token')!;
}
async function confirmedAccount() {
  const res = await app.inject({ method: 'POST', url: '/api/auth/recovery-email', headers: { authorization }, payload: { email: 'OWNER@example.com', password: originalPassword } });
  expect(res.json().sent).toBe(true);
  const token = deliveredToken('verify');
  expect((await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(200);
  return token;
}
async function resetLink() {
  expect((await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'owner@example.com' } })).statusCode).toBe(202);
  await settleMail();
  return deliveredToken('reset');
}

beforeEach(async () => {
  outbox = mkdtempSync(join(tmpdir(), 'lume-email-test-'));
  mail.previewDir = outbox;
  sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys=ON');
  const migrations = fileURLToPath(new URL('../../drizzle/', import.meta.url));
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrations });
  db.insert(schema.users).values({ id: 'owner', username: 'owner', passwordHash: await hashPassword(originalPassword), createdAt: Date.now() }).run();
  authorization = `Bearer ${signJwt({ userId: 'owner', username: 'owner' })}`;
  app = Fastify(); await app.register(rateLimit, { global: false }); await emailRecoveryRoutes(app); await app.ready();
});
afterEach(async () => {
  await app.close(); sqlite.close();
  // Only the exact disposable directory created by this test can be removed.
  if (resolve(outbox).startsWith(resolve(tmpdir()) + '\\lume-email-test-') || resolve(outbox).startsWith(resolve(tmpdir()) + '/lume-email-test-')) rmSync(outbox, { recursive: true, force: true });
  vi.unstubAllEnvs(); vi.restoreAllMocks();
});

describe('private email recovery', () => {
  it('requires the current password, verifies ownership once, and stores only token hashes', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/recovery-email' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/recovery-email', headers: { authorization }, payload: { email: 'owner@example.com', password: 'wrong' } })).statusCode).toBe(403);
    const token = await confirmedAccount();
    const account = db.select().from(schema.accountEmails).get()!;
    expect(account.email).toBe('owner@example.com'); expect(account.pendingEmail).toBeNull();
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(400);
    const reset = await resetLink();
    expect(db.select().from(schema.accountEmailTokens).get()!.tokenHash).toBe(hashEmailToken(reset));
    expect(db.select().from(schema.accountEmailTokens).get()!.tokenHash).not.toBe(reset);
  });
  it('resets once, invalidates old sessions and codes, and rejects the old password', async () => {
    await confirmedAccount(); const token = await resetLink();
    db.insert(schema.recoveryCodes).values({ userId: 'owner', codeHash: 'old-code', createdAt: Date.now() }).run();
    const response = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'a-new-long-password' } });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
    const user = db.select().from(schema.users).get()!;
    expect(await verifyPassword('a-new-long-password', user.passwordHash)).toBe(true);
    expect(await verifyPassword(originalPassword, user.passwordHash)).toBe(false);
    expect(db.select().from(schema.recoveryCodes).all()).toHaveLength(0);
    await expect(verifyJwtAndUser(authorization.slice(7))).rejects.toThrow();
    expect((await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'another-password' } })).statusCode).toBe(400);
  });
  it('does not reveal whether an address exists and throttles repeated mail', async () => {
    await confirmedAccount();
    const known = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'owner@example.com' } });
    const unknown = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'unknown@example.com' } });
    expect(known.statusCode).toBe(unknown.statusCode); expect(known.body).toBe(unknown.body); await settleMail();
    expect(await sendAccountEmail('owner', 'owner@example.com', 'reset')).toBe(false);
    expect(readdirSync(outbox)).toHaveLength(2);
  });
  it('rejects expired links, wrong-purpose links and links from before a password change', async () => {
    await confirmedAccount(); const token = await resetLink();
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(400);
    db.update(schema.accountEmailTokens).set({ expiresAt: Date.now() - 1 }).run();
    expect((await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'a-new-long-password' } })).statusCode).toBe(400);
    db.update(schema.accountEmailTokens).set({ expiresAt: Date.now() + 60_000 }).run();
    db.update(schema.users).set({ passwordChangedAt: Date.now() }).run();
    expect((await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'a-new-long-password' } })).statusCode).toBe(400);
  });
  it('does not recover unconfirmed, deleted, suspended or federated accounts', async () => {
    db.insert(schema.accountEmails).values({ userId: 'owner', pendingEmail: 'owner@example.com' }).run();
    expect(await sendAccountEmail('owner', 'owner@example.com', 'verify')).toBe(true);
    const token = deliveredToken('verify');
    db.update(schema.users).set({ isSuspended: 1 }).run();
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(400);
    expect(await sendAccountEmail('owner', 'owner@example.com', 'reset')).toBe(false);
    db.update(schema.users).set({ isSuspended: 0, isDeleted: 1 }).run();
    expect(await sendAccountEmail('owner', 'owner@example.com', 'reset')).toBe(false);
    db.update(schema.users).set({ isDeleted: 0, homeInstance: 'remote.example' }).run();
    expect(await sendAccountEmail('owner', 'owner@example.com', 'reset')).toBe(false);
  });
  it('preserves the verified address until the replacement is confirmed', async () => {
    await confirmedAccount();
    const res = await app.inject({ method: 'POST', url: '/api/auth/recovery-email', headers: { authorization }, payload: { email: 'new@example.com', password: originalPassword } });
    expect(res.statusCode).toBe(200);
    expect(db.select().from(schema.accountEmails).get()).toMatchObject({ email: 'owner@example.com', pendingEmail: 'new@example.com' });
  });
  it('never enables the local outbox in production and reports an unavailable sender honestly', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(emailDeliveryReady()).toBe(false);
    const res = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'owner@example.com' } });
    expect(res.statusCode).toBe(503);
    expect(readdirSync(outbox)).toHaveLength(0);
  });
  it('enforces IP rate limits before allowing repeated recovery requests', async () => {
    for (let index = 0; index < 5; index++) expect((await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'unknown@example.com' } })).statusCode).toBe(202);
    expect((await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'unknown@example.com' } })).statusCode).toBe(429);
    // Let the asynchronous account lookups finish before closing this test DB.
    await new Promise(resolve => setImmediate(resolve));
  });
});

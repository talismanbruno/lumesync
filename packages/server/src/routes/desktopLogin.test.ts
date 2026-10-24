import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import * as schema from '../db/schema.js';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let app: FastifyInstance;
vi.mock('../db/index.js', () => ({ getDb: () => db, schema }));
import { desktopLoginRoutes } from './desktopLogin.js';
import { signJwt, verifyJwt } from '../utils/auth.js';

const verifier = 'test_native_app_' + 'a'.repeat(40);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const headers = () => ({ authorization: `Bearer ${signJwt({ userId: 'demo', username: 'demo' })}` });
async function authorize() {
  return app.inject({ method: 'POST', url: '/api/auth/desktop/authorize', headers: headers(), payload: { challenge } });
}
async function exchange(code: string, proof = verifier) {
  return app.inject({ method: 'POST', url: '/api/auth/desktop/exchange', payload: { code, verifier: proof } });
}
beforeEach(async () => {
  sqlite = new Database(':memory:');
  const migrations = new URL('../../drizzle/', import.meta.url);
  for (const file of fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    for (const statement of fs.readFileSync(new URL(file, migrations), 'utf8').split(/-->\s*statement-breakpoint/)) if (statement.trim()) sqlite.exec(statement);
  }
  db = drizzle(sqlite, { schema });
  db.insert(schema.users).values({ id: 'demo', username: 'demo', passwordHash: 'not-returned', createdAt: Date.now() }).run();
  app = Fastify(); await app.register(desktopLoginRoutes);
});
afterEach(async () => { vi.restoreAllMocks(); await app.close(); sqlite.close(); });

describe('browser to desktop authorization', () => {
  it('requires a valid browser session to authorize the app', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/desktop/authorize', payload: { challenge } });
    expect(response.statusCode).toBe(401);
  });
  it('accepts only S256 challenges and rejects missing or malformed bodies', async () => {
    for (const payload of [{}, { challenge: 'plain-verifier' }, { challenge: {} }, { challenge: 'a'.repeat(5000) }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/desktop/authorize', headers: headers(), payload });
      expect(response.statusCode).toBe(400);
    }
  });
  it('returns a short-lived opaque code, not the browser session', async () => {
    const response = await authorize(); expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ code: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('exchanges the proof for a separate authenticated session and sanitized user', async () => {
    const code = (await authorize()).json().code;
    const response = await exchange(code); expect(response.statusCode).toBe(200);
    expect(verifyJwt(response.json().token).userId).toBe('demo');
    expect(response.json().user.username).toBe('demo');
    expect(response.json().user.passwordHash).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
  });
  it('rejects interception without the app proof without consuming a valid authorization', async () => {
    const code = (await authorize()).json().code;
    expect((await exchange(code, 'x'.repeat(43))).statusCode).toBe(400);
    expect((await exchange(code)).statusCode).toBe(200);
  });
  it('rejects code replay and simultaneous exchanges', async () => {
    const code = (await authorize()).json().code;
    const results = await Promise.all([exchange(code), exchange(code)]);
    expect(results.map(response => response.statusCode).sort()).toEqual([200, 400]);
    expect((await exchange(code)).statusCode).toBe(400);
  });
  it('expires the authorization after one minute', async () => {
    const code = (await authorize()).json().code;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
    expect((await exchange(code)).statusCode).toBe(400);
  });
  it.each(['password', 'suspended', 'deleted'])('invalidates authorization when the account becomes %s', async change => {
    const code = (await authorize()).json().code;
    db.update(schema.users).set(change === 'password' ? { passwordChangedAt: Date.now() } : change === 'suspended' ? { isSuspended: 1 } : { isDeleted: 1 }).where(eq(schema.users.id, 'demo')).run();
    expect((await exchange(code)).statusCode).toBe(400);
  });
  it('does not share authorizations across instances or server restarts', async () => {
    const code = (await authorize()).json().code;
    const other = Fastify(); await other.register(desktopLoginRoutes);
    const response = await other.inject({ method: 'POST', url: '/api/auth/desktop/exchange', payload: { code, verifier } });
    expect(response.statusCode).toBe(400); await other.close();
    expect((await exchange(code)).statusCode).toBe(200);
  });
  it('does not accept codes from other flows or malformed proofs', async () => {
    expect((await exchange('a'.repeat(64))).statusCode).toBe(400);
    expect((await exchange((await authorize()).json().code, 'short')).statusCode).toBe(400);
  });
});

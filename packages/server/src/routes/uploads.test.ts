import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { signJwt } from '../utils/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let sqlite: Database.Database;
let testDb: TestDb;
let app: FastifyInstance;
let tmpDir: string;

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
        if (prop === 'uploadDir') return tmpDir ?? target.uploadDir;
        return (target as Record<string, unknown>)[prop];
      },
    }),
  };
});

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const statement of sqlText.split(/-->\s*statement-breakpoint/)) {
      if (statement.trim()) db.exec(statement.trim());
    }
  }
}

const OWNER_ID = 'upload-owner';
const OUTSIDER_ID = 'upload-outsider';
const CHANNEL_FILE = 'channel-secret.txt';
const CHANNEL_THUMB = 'channel-secret-thumb.png';
const DM_FILE = 'dm-secret.txt';

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-upload-auth-'));
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  testDb = drizzle(sqlite, { schema });

  const now = Date.now();
  testDb.insert(schema.users).values([
    { id: OWNER_ID, username: 'owner', passwordHash: 'x', createdAt: now },
    { id: OUTSIDER_ID, username: 'outsider', passwordHash: 'x', createdAt: now },
  ]).run();

  testDb.insert(schema.spaces).values({
    id: 'private-space', name: 'Private', ownerId: OWNER_ID, createdAt: now,
  }).run();
  testDb.insert(schema.channels).values({
    id: 'private-channel', spaceId: 'private-space', name: 'private', type: 'text', createdAt: now,
  }).run();
  testDb.insert(schema.messages).values({
    id: 'channel-message', channelId: 'private-channel', userId: OWNER_ID, createdAt: now,
  }).run();
  testDb.insert(schema.attachments).values({
    id: 'channel-attachment', messageId: 'channel-message', uploaderId: OWNER_ID,
    filename: CHANNEL_FILE, thumbnailFilename: CHANNEL_THUMB, originalName: 'secret.txt',
    mimetype: 'text/plain', size: 14, createdAt: now,
  }).run();

  testDb.insert(schema.dmChannels).values({ id: 'private-dm', createdAt: now }).run();
  testDb.insert(schema.dmMembers).values({ dmChannelId: 'private-dm', userId: OWNER_ID }).run();
  testDb.insert(schema.dmMessages).values({
    id: 'dm-message', dmChannelId: 'private-dm', userId: OWNER_ID, createdAt: now,
  }).run();
  testDb.insert(schema.attachments).values({
    id: 'dm-attachment', dmMessageId: 'dm-message', uploaderId: OWNER_ID,
    filename: DM_FILE, originalName: 'dm-secret.txt', mimetype: 'text/plain', size: 9, createdAt: now,
  }).run();

  testDb.insert(schema.attachments).values({
    id: 'public-asset', uploaderId: OWNER_ID, filename: 'avatar.png', originalName: 'avatar.png',
    mimetype: 'image/png', size: 6, createdAt: now,
  }).run();

  fs.writeFileSync(path.join(tmpDir, CHANNEL_FILE), 'channel secret');
  fs.writeFileSync(path.join(tmpDir, CHANNEL_THUMB), 'thumbnail');
  fs.writeFileSync(path.join(tmpDir, DM_FILE), 'dm secret');
  fs.writeFileSync(path.join(tmpDir, 'avatar.png'), 'avatar');

  const { uploadRoutes } = await import('./uploads.js');
  app = Fastify();
  await app.register(uploadRoutes);
});

afterEach(async () => {
  await app.close();
  sqlite.close();
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe('GET /api/uploads/:filename private attachment authorization', () => {
  it('rejects anonymous and non-member access to a channel attachment', async () => {
    const anonymous = await app.inject({ method: 'GET', url: `/api/uploads/${CHANNEL_FILE}` });
    expect(anonymous.statusCode).toBe(401);

    const outsiderToken = signJwt({ userId: OUTSIDER_ID, username: 'outsider' });
    const outsider = await app.inject({
      method: 'GET', url: `/api/uploads/${CHANNEL_FILE}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(outsider.statusCode).toBe(403);
  });

  it('serves a channel attachment and its thumbnail to an authorized reader', async () => {
    const token = signJwt({ userId: OWNER_ID, username: 'owner' });
    const cookie = `lume_media_token=${encodeURIComponent(token)}`;

    const attachment = await app.inject({
      method: 'GET', url: `/api/uploads/${CHANNEL_FILE}`, headers: { cookie },
    });
    expect(attachment.statusCode).toBe(200);
    expect(attachment.body).toBe('channel secret');
    expect(attachment.headers['cache-control']).toBe('private, no-store');

    const thumbnail = await app.inject({
      method: 'GET', url: `/api/uploads/${CHANNEL_THUMB}`, headers: { cookie },
    });
    expect(thumbnail.statusCode).toBe(200);
    expect(thumbnail.body).toBe('thumbnail');
    expect(thumbnail.headers['content-type']).toContain('image/png');
  });

  it('rejects a non-member and serves a member of a DM', async () => {
    const outsiderToken = signJwt({ userId: OUTSIDER_ID, username: 'outsider' });
    const outsider = await app.inject({
      method: 'GET', url: `/api/uploads/${DM_FILE}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(outsider.statusCode).toBe(403);

    testDb.insert(schema.dmMembers).values({ dmChannelId: 'private-dm', userId: OUTSIDER_ID }).run();
    const newlyAuthorized = await app.inject({
      method: 'GET', url: `/api/uploads/${DM_FILE}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(newlyAuthorized.statusCode).toBe(200);

    testDb.delete(schema.dmMembers).where(and(
      eq(schema.dmMembers.dmChannelId, 'private-dm'),
      eq(schema.dmMembers.userId, OUTSIDER_ID),
    )).run();
    const revoked = await app.inject({
      method: 'GET', url: `/api/uploads/${DM_FILE}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(revoked.statusCode).toBe(403);

    const ownerToken = signJwt({ userId: OWNER_ID, username: 'owner' });
    const member = await app.inject({
      method: 'GET', url: `/api/uploads/${DM_FILE}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(member.statusCode).toBe(200);
    expect(member.body).toBe('dm secret');
  });

  it('preserves anonymous access for unlinked profile and space assets', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/uploads/avatar.png' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('avatar');
    expect(response.headers['cache-control']).toContain('public');
  });

  it('serves valid ranges and rejects malformed or unsatisfiable ranges', async () => {
    for (const [range, expected] of [
      ['bytes=1-3', 'vat'],
      ['bytes=4-', 'ar'],
      ['bytes=-2', 'ar'],
      ['bytes=4-99', 'ar'],
    ]) {
      const response = await app.inject({ method: 'GET', url: '/api/uploads/avatar.png', headers: { range } });
      expect(response.statusCode).toBe(206);
      expect(response.body).toBe(expected);
    }
    for (const range of ['bytes=abc-2', 'bytes=4-2', 'bytes=6-', 'bytes=-0', 'bytes=0-1,3-4']) {
      const response = await app.inject({ method: 'GET', url: '/api/uploads/avatar.png', headers: { range } });
      expect(response.statusCode).toBe(416);
      expect(response.headers['content-range']).toBe('bytes */6');
    }
  });
});

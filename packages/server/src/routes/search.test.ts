import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { signJwt } from '../utils/auth.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let app: FastifyInstance;

vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));

beforeEach(async () => {
  sqlite = new Database(':memory:');
  for (const file of fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
    for (const statement of fs.readFileSync(path.join(migrationsDir, file), 'utf8').split(/-->\s*statement-breakpoint/)) {
      if (statement.trim()) sqlite.exec(statement.trim());
    }
  }
  db = drizzle(sqlite, { schema });
  const now = Date.now();
  db.insert(schema.users).values({ id: 'reader', username: 'reader', passwordHash: 'x', createdAt: now }).run();
  db.insert(schema.spaces).values({ id: 'space', name: 'Space', ownerId: 'reader', createdAt: now }).run();
  db.insert(schema.channels).values({ id: 'channel', spaceId: 'space', name: 'chat', type: 'text', createdAt: now }).run();
  db.insert(schema.messages).values([
    { id: 'plain', channelId: 'channel', userId: 'reader', content: 'hello world', createdAt: now },
    { id: 'link', channelId: 'channel', userId: 'reader', content: 'https://example.test', createdAt: now + 1 },
  ]).run();
  db.insert(schema.dmChannels).values({ id: 'dm', createdAt: now }).run();
  db.insert(schema.dmMembers).values({ dmChannelId: 'dm', userId: 'reader' }).run();
  db.insert(schema.dmMessages).values([
    { id: 'dm-plain', dmChannelId: 'dm', userId: 'reader', content: 'hello world', createdAt: now },
    { id: 'dm-link', dmChannelId: 'dm', userId: 'reader', content: 'http://example.test', createdAt: now + 1 },
  ]).run();
  const { searchRoutes } = await import('./search.js');
  app = Fastify();
  await app.register(searchRoutes);
});

afterEach(async () => { await app.close(); sqlite.close(); });

describe('has=link search', () => {
  for (const [url, expected] of [
    ['/api/channels/channel/search?has=link', 'link'],
    ['/api/dm/dm/search?has=link', 'dm-link'],
  ]) {
    it(`filters results and count for ${url}`, async () => {
      const token = signJwt({ userId: 'reader', username: 'reader' });
      const response = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json().totalCount).toBe(1);
      expect(response.json().results.map((result: { id: string }) => result.id)).toEqual([expected]);
    });
  }
});

describe('indexed text search', () => {
  for (const [url, expected] of [
    ['/api/channels/channel/search?q=example', 'link'],
    ['/api/dm/dm/search?q=example', 'dm-link'],
  ]) {
    it(`finds matching text and tracks edits for ${url}`, async () => {
      const token = signJwt({ userId: 'reader', username: 'reader' });
      const headers = { authorization: `Bearer ${token}` };
      const initial = await app.inject({ method: 'GET', url, headers });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().results.map((result: { id: string }) => result.id)).toEqual([expected]);
      const table = expected === 'link' ? schema.messages : schema.dmMessages;
      db.update(table).set({ content: 'no matching text' }).run();
      const edited = await app.inject({ method: 'GET', url, headers });
      expect(edited.json().totalCount).toBe(0);
    });
  }
});

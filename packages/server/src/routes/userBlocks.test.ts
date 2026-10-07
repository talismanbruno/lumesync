import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import * as schema from '../db/schema.js';
import { userBlockRoutes } from './userBlocks.js';
import { dmRoutes } from './dm.js';
import { hasUserBlock, isBlockedDirectConversation, suppressBlockedContactEvent } from '../utils/userBlocks.js';
import { handleClientEvent } from '../ws/events.js';

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../utils/auth.js', () => ({ authenticate: async (request: any) => { request.userId = request.headers['x-test-user'] || 'alice'; } }));
vi.mock('../ws/handler.js', () => ({ connectionManager: { sendToUser: vi.fn() } }));
import { connectionManager } from '../ws/handler.js';
const app = () => {
  const server = Fastify();
  server.register(userBlockRoutes);
  server.register(dmRoutes);
  return server;
};
function seedUser(id: string, homeUserId?: string, homeInstance?: string) {
  db.insert(schema.users).values({ id, username: id, passwordHash: 'secret-not-for-response', createdAt: 1, homeUserId, homeInstance }).run();
}
beforeEach(() => {
  vi.clearAllMocks();
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const dir = new URL('../../drizzle/', import.meta.url);
  for (const file of readdirSync(dir).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));
  db = drizzle(sqlite, { schema });
  for (const id of ['alice', 'bob', 'carol']) seedUser(id);
  db.insert(schema.dmChannels).values({ id: 'dm', createdAt: 1 }).run();
  db.insert(schema.dmMembers).values([{ dmChannelId: 'dm', userId: 'alice' }, { dmChannelId: 'dm', userId: 'bob' }]).run();
});
afterEach(() => sqlite.close());

describe('contact blocking', () => {
  it('persists a block, isolates accounts and returns sanitized profiles', async () => {
    const server = app();
    expect((await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' })).statusCode).toBe(200);
    const response = await server.inject('/api/social/blocks');
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].id).toBe('bob');
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain('secret-not-for-response');
    expect((await server.inject({ url: '/api/social/blocks', headers: { 'x-test-user': 'carol' } })).json()).toEqual([]);
    await server.close();
  });
  it('is idempotent and can be undone without removing history or membership', async () => {
    const server = app();
    db.insert(schema.dmMessages).values({ id: 'old-message', dmChannelId: 'dm', userId: 'bob', content: 'history', createdAt: 1 }).run();
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    expect((await server.inject('/api/social/blocks')).json()).toHaveLength(1);
    expect(isBlockedDirectConversation('dm', 'alice')).toBe(true);
    expect(isBlockedDirectConversation('dm', 'bob')).toBe(true);
    await server.inject({ method: 'DELETE', url: '/api/social/blocks/bob' });
    expect(isBlockedDirectConversation('dm', 'bob')).toBe(false);
    expect(db.select().from(schema.dmMessages).all()).toHaveLength(1);
    expect(db.select().from(schema.dmMembers).all()).toHaveLength(2);
    await server.close();
  });
  it('rejects self-blocks, unknown profiles and unauthorized unblocking', async () => {
    const server = app();
    expect((await server.inject({ method: 'PUT', url: '/api/social/blocks/alice' })).statusCode).toBe(400);
    expect((await server.inject({ method: 'PUT', url: '/api/social/blocks/missing' })).statusCode).toBe(404);
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    await server.inject({ method: 'DELETE', url: '/api/social/blocks/bob', headers: { 'x-test-user': 'carol' } });
    expect(hasUserBlock('alice', 'bob')).toBe(true);
    await server.close();
  });
  it('matches replicated aliases by stable home identity, including self aliases', async () => {
    const server = app();
    seedUser('remote-bob', 'home-bob', 'https://remote.example');
    seedUser('remote-bob-alias', 'home-bob', 'remote.example');
    await server.inject({ method: 'PUT', url: '/api/social/blocks/remote-bob' });
    expect(hasUserBlock('alice', 'remote-bob-alias')).toBe(true);
    await server.inject({ method: 'DELETE', url: '/api/social/blocks/remote-bob-alias' });
    expect(hasUserBlock('alice', 'remote-bob')).toBe(false);
    await server.close();
  });
  it('denies direct messages in both directions before writing', async () => {
    const server = app();
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    for (const user of ['alice', 'bob']) {
      const response = await server.inject({ method: 'POST', url: '/api/dm/dm/messages', headers: { 'x-test-user': user }, payload: { content: 'blocked' } });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('contact_blocked');
    }
    expect(db.select().from(schema.dmMessages).all()).toHaveLength(0);
    await server.close();
  });
  it('ends blocked call attempts before allocating a voice room', async () => {
    const server = app();
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    handleClientEvent({ type: 'dm_call_start', dmChannelId: 'dm' }, 'bob', 'bob', {} as any, false);
    expect(connectionManager.sendToUser).toHaveBeenCalledWith('bob', { type: 'dm_call_ended', dmChannelId: 'dm' });
    await server.close();
  });
  it('filters blocked private events but keeps unrelated users and community events', async () => {
    const server = app();
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    expect(suppressBlockedContactEvent('alice', { type: 'dm_message_created', message: { userId: 'bob' } } as any)).toBe(true);
    expect(suppressBlockedContactEvent('alice', { type: 'dm_call_incoming', callerId: 'bob' } as any)).toBe(true);
    expect(suppressBlockedContactEvent('alice', { type: 'friend_request_received', request: { fromId: 'bob' } } as any)).toBe(true);
    expect(suppressBlockedContactEvent('alice', { type: 'dm_call_incoming', callerId: 'carol' } as any)).toBe(false);
    expect(suppressBlockedContactEvent('alice', { type: 'message_created', message: { userId: 'bob' } } as any)).toBe(false);
    await server.close();
  });
  it('preserves group conversations and permits other members to send', async () => {
    const server = app();
    await server.inject({ method: 'PUT', url: '/api/social/blocks/bob' });
    db.insert(schema.dmChannels).values({ id: 'group', ownerId: 'alice', createdAt: 1 }).run();
    db.insert(schema.dmMembers).values([{ dmChannelId: 'group', userId: 'alice' }, { dmChannelId: 'group', userId: 'bob' }, { dmChannelId: 'group', userId: 'carol' }]).run();
    expect(isBlockedDirectConversation('group', 'bob')).toBe(false);
    expect(isBlockedDirectConversation('group', 'carol')).toBe(false);
    await server.close();
  });
});

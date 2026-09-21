import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentUserId = 'regular-user';

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  schema,
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = currentUserId;
  },
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
    sendToDmMembers: vi.fn(),
    sendToAdmins: vi.fn(),
    getAllOnlineUserIds: () => [],
  },
}));

vi.mock('../utils/federationOutbox.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/federationOutbox.js')>('../utils/federationOutbox.js');
  return {
    ...actual,
    isFederationRelayEnabled: () => false,
    queueDmCloseRelay: vi.fn(),
    sendTypingRelay: vi.fn(),
    queueDmRelay: vi.fn(),
    queueOutboxEvent: vi.fn(),
    appendMutationLog: vi.fn(),
  };
});

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const statement of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = statement.trim();
      if (clean) db.exec(clean);
    }
  }
}

function seedUser(id: string, username: string, isAdmin = 0): void {
  testDb.insert(schema.users).values({
    id,
    username,
    displayName: username,
    passwordHash: 'x',
    isAdmin,
    createdAt: Date.now(),
  }).run();
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { dmRoutes } = await import('./dm.js');
  await app.register(dmRoutes);
  await app.ready();
  return app;
}

describe('POST /api/dm — admin friendship bypass', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite, { schema });
    applyMigrations(sqlite);
    seedUser('regular-user', 'regular');
    seedUser('admin-user', 'admin', 1);
    seedUser('target-user', 'target');
  });

  it('blocks a regular user from starting a new DM with a non-friend', async () => {
    currentUserId = 'regular-user';
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/dm',
      payload: { userId: 'target-user' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toContain('adicionar');
    expect(testDb.select().from(schema.dmChannels).all()).toHaveLength(0);
  });

  it('allows an administrator to start a new DM with a non-friend', async () => {
    currentUserId = 'admin-user';
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/dm',
      payload: { userId: 'target-user' },
    });

    expect(response.statusCode).toBe(201);
    expect(testDb.select().from(schema.dmChannels).all()).toHaveLength(1);
  });

  it('allows a regular user to start a DM with a friend', async () => {
    testDb.insert(schema.friends).values({
      userId: 'regular-user',
      friendId: 'target-user',
      createdAt: Date.now(),
    }).run();
    currentUserId = 'regular-user';
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/dm',
      payload: { userId: 'target-user' },
    });

    expect(response.statusCode).toBe(201);
  });
});

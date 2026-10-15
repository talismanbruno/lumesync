import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { signJwt } from '../utils/auth.js';
import { isProfileCustomization, parseProfileCustomization } from '@backspace/shared';

const fixture = vi.hoisted(() => ({ root: '' }));
vi.mock('../config.js', async importOriginal => {
  const original = await importOriginal<typeof import('../config.js')>();
  return { config: { ...original.config, get customizationDir() { return fixture.root; } } };
});
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let app: FastifyInstance;
vi.mock('../db/index.js', () => ({ getDb: () => db, getRawDb: () => sqlite, schema }));
vi.mock('../ws/handler.js', () => ({ connectionManager: {
  sendToUser: vi.fn(), sendToSpace: vi.fn(), sendToDmMembers: vi.fn(),
  setUserStatus: vi.fn(), getUserActivities: () => [], setUserShowActivity: vi.fn(),
  clearUserActivities: vi.fn(), getUserStatus: () => 'online',
} }));

const customization = { bannerFlag: 'br', nameplateFlag: 'pt', avatarDecorationId: '101', profileEffectId: '102', nameplateId: '103', profileFrameId: '104', nameFont: 'Tempo', nameEffect: 'gradient', nameColors: ['#8ee7d1', '#b4a8ff'], themeColor: '#181b24', themeSecondaryColor: '#285eb8' };
const authorization = () => ({ authorization: `Bearer ${signJwt({ userId: 'local-style-user', username: 'style_test' })}` });

beforeEach(async () => {
  fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), 'lume-customization-test-'));
  fs.mkdirSync(path.join(fixture.root, 'assets'));
  fs.writeFileSync(path.join(fixture.root, 'assets', 'sample.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfL8AAAAASUVORK5CYII=', 'base64'));
  fs.writeFileSync(path.join(fixture.root, 'catalog.json'), JSON.stringify({ items: [0, 1, 2, 3].map(type => ({ id: String(101 + type), type, name: `Style ${type}`, category: 'Test', categoryId: '1', description: '', staticSrc: '/api/customization/assets/sample.png', animatedSrc: '/api/customization/assets/sample.png' })) }));
  sqlite = new Database(':memory:');
  const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
  for (const file of fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    for (const statement of fs.readFileSync(path.join(migrations, file), 'utf8').split(/-->\s*statement-breakpoint/)) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
  db = drizzle(sqlite, { schema });
  db.insert(schema.users).values({ id: 'local-style-user', username: 'style_test', passwordHash: 'fixture', avatar: 'avatar.gif', banner: 'banner.gif', nameColor: '#b4a8ff', createdAt: Date.now() }).run();
  app = Fastify();
  const { userRoutes } = await import('./users.js');
  const { customizationRoutes } = await import('./customization.js');
  await app.register(userRoutes);
  await app.register(customizationRoutes);
  await app.ready();
});
afterEach(async () => {
  await app?.close(); sqlite?.close();
  const target = path.resolve(fixture.root);
  if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('lume-customization-test-')) fs.rmSync(target, { recursive: true, force: true });
});

describe('profile customization', () => {
  it.each(['#23b7a4', '#FFFFFF', '#000000', 'sky'])('persists an avatar color through profile reload: %s', async avatarColor => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: authorization(), payload: { avatarColor } });
    expect(response.statusCode).toBe(200);
    expect(response.json().avatarColor).toBe(avatarColor);
    const reloaded = await app.inject({ method: 'GET', url: '/api/users/@me', headers: authorization() });
    expect(reloaded.json().avatarColor).toBe(avatarColor);
  });
  it.each(['#fff', '#12345678', 'url(https://example.com)', 'red', '#xxxxxx'])('rejects invalid custom avatar colors: %s', async avatarColor => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: authorization(), payload: { avatarColor } });
    expect(response.statusCode).toBe(400);
    expect(db.select().from(schema.users).get()?.avatarColor).toBeNull();
  });
  it('keeps browsing media outside the API budget while still limiting profile writes', async () => {
    const { customizationRoutes, isCustomizationMediaRequest } = await import('./customization.js');
    const limited = Fastify();
    try {
      await limited.register(rateLimit, { max: 3, timeWindow: '1 minute', allowList: request => isCustomizationMediaRequest(request.method, request.routeOptions.url ?? '') });
      await limited.register(customizationRoutes);
      limited.patch('/profile', async () => ({ saved: true }));
      for (let index = 0; index < 12; index++) {
        expect((await limited.inject({ method: index % 2 ? 'GET' : 'HEAD', url: '/api/customization/assets/sample.png' })).statusCode).toBe(200);
        expect((await limited.inject({ method: 'GET', url: '/api/customization/items/101/static' })).statusCode).toBe(302);
      }
      for (let index = 0; index < 3; index++) expect((await limited.inject({ method: 'PATCH', url: '/profile' })).statusCode).toBe(200);
      expect((await limited.inject({ method: 'PATCH', url: '/profile' })).statusCode).toBe(429);
      expect((await limited.inject({ method: 'GET', url: '/api/customization/catalog' })).statusCode).toBe(429);
      expect(isCustomizationMediaRequest('POST', '/api/customization/assets/*')).toBe(false);
      expect(isCustomizationMediaRequest('GET', '/api/customization/assets-pretend/*')).toBe(false);
    } finally { await limited.close(); }
  });
  it('persists all four selections and name styling, returns parsed data, and preserves existing GIFs and name color', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: authorization(), payload: { customization } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ customization, avatar: 'avatar.gif', banner: 'banner.gif', nameColor: '#b4a8ff' });
    expect(parseProfileCustomization(db.select().from(schema.users).where(eq(schema.users.id, 'local-style-user')).get()?.customization)).toEqual(customization);
    const reloaded = await app.inject({ method: 'GET', url: '/api/users/@me', headers: authorization() });
    expect(reloaded.json().customization).toEqual(customization);
  });
  it('clears selections explicitly', async () => {
    db.update(schema.users).set({ customization: JSON.stringify(customization) }).run();
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: authorization(), payload: { customization: null } });
    expect(response.statusCode).toBe(200);
    expect(response.json().customization).toBeNull();
    expect(db.select().from(schema.users).get()?.customization).toBeNull();
  });
  it.each([
    { avatarDecorationId: '102' }, { avatarDecorationId: '999' },
    { avatarDecorationId: '../asset' }, { nameFont: 'unknown' },
    { nameEffect: 'url(javascript:alert(1))' }, { nameColors: ['red'] },
    { themeColor: '#fff' }, { themeSecondaryColor: '#fff' }, { themeSecondaryColor: 'url(https://example.com)' }, { injectedCss: 'position:fixed' },
    { bannerFlag: '../secret' }, { nameplateFlag: 'https://example.com/image.svg' },
    { bannerFlag: 'zz' }, { nameplateFlag: 'BR' },
  ])('rejects unavailable, mismatched, and unsafe selections: %j', async value => {
    const response = await app.inject({ method: 'PATCH', url: '/api/users/@me', headers: authorization(), payload: { customization: value } });
    expect(response.statusCode).toBe(400);
    expect(db.select().from(schema.users).get()?.customization).toBeNull();
  });
  it('serves the catalog and local media, redirects known IDs, and rejects invalid formats', async () => {
    const catalog = await app.inject('/api/customization/catalog');
    expect(catalog.json().items).toHaveLength(4);
    const image = await app.inject('/api/customization/assets/sample.png');
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.headers['cache-control']).toContain('immutable');
    const redirect = await app.inject('/api/customization/items/101/animated');
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe('/api/customization/assets/sample.png');
    expect((await app.inject('/api/customization/items/101/invalid')).statusCode).toBe(404);
    expect((await app.inject('/api/customization/items/999/static')).statusCode).toBe(404);
  });
  it('safely parses malformed replicated profile data', () => {
    expect(isProfileCustomization(null)).toBe(true);
    expect(parseProfileCustomization('{broken')).toBeNull();
    expect(parseProfileCustomization({ nameColors: ['#fff000'], extra: 'bad' })).toBeNull();
    expect(parseProfileCustomization(JSON.stringify(customization))).toEqual(customization);
  });
});

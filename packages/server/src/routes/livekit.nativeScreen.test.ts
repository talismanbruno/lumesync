import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

let dmMember = false;
let permissions = 0n;

vi.mock('../config.js', () => ({
  config: { livekit: { apiKey: 'key', apiSecret: 'secret-secret-secret-secret-secret', url: 'wss://livekit.test' } },
}));
vi.mock('../utils/auth.js', () => ({
  authenticate: async (request: { userId?: string; username?: string }) => {
    request.userId = 'user-1';
    request.username = 'ana';
  },
}));
vi.mock('../utils/permissions.js', () => ({
  PermissionBits: { CONNECT: 1n, SPEAK: 2n, STREAM: 4n, ADMINISTRATOR: 8n },
  getChannelSpaceId: () => 'space-1',
  hasPermission: () => true,
  computePermissions: () => permissions,
  isDmMember: () => dmMember,
}));
vi.mock('../db/index.js', () => ({ getDb: vi.fn(), schema: {} }));
vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    getUserRoom: () => ({ roomId: 'voice-1' }),
    getRoomParticipants: () => new Set(['user-1']),
    getOperationalStats: () => ({ voiceParticipants: 1 }),
  },
}));
vi.mock('../utils/voiceCapacity.js', () => ({
  clearVoiceCapacityReservation: vi.fn(),
  evaluateVoiceCapacity: () => null,
  getVoiceReservationCounts: () => ({ room: 0, total: 0 }),
  readVoiceCapacityLimits: () => ({}),
  reserveVoiceCapacity: vi.fn(),
}));

describe('native Android screen token authorization', () => {
  beforeEach(() => { dmMember = false; permissions = 0n; });

  it('does not issue a DM screen token to a non-member', async () => {
    const app = Fastify();
    const { livekitRoutes } = await import('./livekit.js');
    await app.register(livekitRoutes);
    const response = await app.inject({
      method: 'POST', url: '/api/livekit/token',
      payload: { dmChannelId: 'private-dm', nativeScreenShare: true },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  }, 15_000);

  it('requires STREAM permission for a channel screen token', async () => {
    const app = Fastify();
    const { livekitRoutes } = await import('./livekit.js');
    await app.register(livekitRoutes);
    const response = await app.inject({
      method: 'POST', url: '/api/livekit/token',
      payload: { channelId: 'voice-1', nativeScreenShare: true },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toContain('STREAM');
    await app.close();
  }, 15_000);
});

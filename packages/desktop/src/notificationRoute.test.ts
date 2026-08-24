import { describe, expect, it } from 'vitest';
import { buildNotificationRoute } from './notificationRoute';

describe('buildNotificationRoute', () => {
  it('opens a direct message by default', () => {
    expect(buildNotificationRoute({ channelId: 'dm-123' })).toBe('/channels/@me/dm-123');
  });

  it('opens a community channel', () => {
    expect(buildNotificationRoute({ channelId: 'chat-7', spaceId: 'space-4' }))
      .toBe('/channels/space-4/chat-7');
  });

  it('encodes path separators and rejects missing targets', () => {
    expect(buildNotificationRoute({ channelId: 'dm/unsafe' })).toBe('/channels/@me/dm%2Funsafe');
    expect(buildNotificationRoute(undefined)).toBeNull();
    expect(buildNotificationRoute({ channelId: '' })).toBeNull();
  });
});

export interface NotificationNavigationTarget {
  channelId?: string;
  spaceId?: string;
}

function safeRouteSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 256 || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return encodeURIComponent(trimmed);
}

/** Builds a renderer route without allowing notification data to inject a path. */
export function buildNotificationRoute(target: NotificationNavigationTarget | undefined): string | null {
  const channelId = safeRouteSegment(target?.channelId);
  if (!channelId) return null;

  const rawSpaceId = target?.spaceId || '@me';
  const spaceId = rawSpaceId === '@me' ? '@me' : safeRouteSegment(rawSpaceId);
  if (!spaceId) return null;

  return `/channels/${spaceId}/${channelId}`;
}

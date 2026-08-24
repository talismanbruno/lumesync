const APP_PERMISSIONS = new Set([
  'display-capture',
  'fullscreen',
  'media',
  'notifications',
  'pointerLock',
  'speaker-selection',
]);

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function shouldGrantAppPermission(
  permission: string,
  requestingUrl: string,
  trustedOrigins: ReadonlySet<string>,
): boolean {
  const origin = normalizeOrigin(requestingUrl);
  return origin !== null && trustedOrigins.has(origin) && APP_PERMISSIONS.has(permission);
}

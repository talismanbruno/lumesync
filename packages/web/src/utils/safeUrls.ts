const SAFE_DATA_IMAGE_PREFIXES = [
  'data:image/avif;base64,',
  'data:image/gif;base64,',
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
] as const;

function isBase64Payload(value: string): boolean {
  if (!value) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const valid =
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 43 || code === 47 || code === 61;
    if (!valid) return false;
  }
  return true;
}

/**
 * Restrict image sources to network images, same-origin paths, local blob URLs,
 * and inert raster data URLs. SVG data URLs and executable URL schemes are
 * deliberately rejected.
 */
export function sanitizeImageSource(value: string | null | undefined): string | null {
  if (!value) return null;

  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    return value;
  }

  const lower = value.toLowerCase();
  for (const prefix of SAFE_DATA_IMAGE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return isBase64Payload(value.slice(prefix.length)) ? value : null;
    }
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'blob:') return value;
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        !parsed.username && !parsed.password) {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function isSafeUploadFilename(value: string): boolean {
  if (!value || value === '.' || value === '..') return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const valid =
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 45 || code === 46 || code === 95;
    if (!valid) return false;
  }
  return true;
}

export function resolveAvatarSource(value: string | null | undefined): string | null {
  const direct = sanitizeImageSource(value);
  if (direct || !value || !isSafeUploadFilename(value)) return direct;
  return `/api/uploads/${encodeURIComponent(value)}`;
}

/** Build the explicit cross-instance invite URL from a host-only user input. */
export function buildExternalJoinUrl(domain: string, qualifiedCode: string): string | null {
  const host = domain.trim();
  if (!host) return null;

  // This field accepts a host (and optional port), never a path or credentials.
  for (const forbidden of ['/', '\\', '@', '?', '#']) {
    if (host.includes(forbidden)) return null;
  }
  for (let index = 0; index < host.length; index++) {
    if (host.charCodeAt(index) <= 32) return null;
  }

  try {
    const target = new URL(`https://${host}`);
    if (target.protocol !== 'https:' || !target.hostname || target.username || target.password) {
      return null;
    }
    target.pathname = `/join/${encodeURIComponent(qualifiedCode)}`;
    target.search = '';
    target.hash = '';
    return target.href;
  } catch {
    return null;
  }
}

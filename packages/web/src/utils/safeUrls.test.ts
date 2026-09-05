import { describe, expect, it } from 'vitest';
import { buildExternalJoinUrl, resolveAvatarSource, sanitizeImageSource } from './safeUrls';

describe('sanitizeImageSource', () => {
  it('allows same-origin, HTTPS, HTTP, blob, and raster data images', () => {
    expect(sanitizeImageSource('/api/uploads/avatar.webp')).toBe('/api/uploads/avatar.webp');
    expect(sanitizeImageSource('https://cdn.example/avatar.png')).toBe('https://cdn.example/avatar.png');
    expect(sanitizeImageSource('http://localhost:3000/avatar.png')).toBe('http://localhost:3000/avatar.png');
    expect(sanitizeImageSource('blob:https://lume.example/4b41ca43')).toBe('blob:https://lume.example/4b41ca43');
    expect(sanitizeImageSource('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=');
  });

  it('rejects executable, protocol-relative, credentialed, SVG, and malformed sources', () => {
    expect(sanitizeImageSource('javascript:alert(1)')).toBeNull();
    expect(sanitizeImageSource('//attacker.example/avatar.png')).toBeNull();
    expect(sanitizeImageSource('https://user:secret@attacker.example/avatar.png')).toBeNull();
    expect(sanitizeImageSource('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull();
    expect(sanitizeImageSource('/safe/..\\unsafe')).toBeNull();
  });
});

describe('resolveAvatarSource', () => {
  it('converts a server-generated filename into a same-origin upload path', () => {
    expect(resolveAvatarSource('avatar_123.webp')).toBe('/api/uploads/avatar_123.webp');
  });

  it('rejects filenames containing path separators or URL syntax', () => {
    expect(resolveAvatarSource('../avatar.webp')).toBeNull();
    expect(resolveAvatarSource('avatar/name.webp')).toBeNull();
  });
});

describe('buildExternalJoinUrl', () => {
  it('builds an HTTPS invite URL from a host and optional port', () => {
    expect(buildExternalJoinUrl('orbit.example:8443', 'invite@home.example'))
      .toBe('https://orbit.example:8443/join/invite%40home.example');
  });

  it('rejects paths, credentials, whitespace, and alternate schemes', () => {
    expect(buildExternalJoinUrl('attacker.example/path', 'code')).toBeNull();
    expect(buildExternalJoinUrl('user@attacker.example', 'code')).toBeNull();
    expect(buildExternalJoinUrl('attacker.example\n.example', 'code')).toBeNull();
    expect(buildExternalJoinUrl('javascript:alert(1)', 'code')).toBeNull();
  });
});

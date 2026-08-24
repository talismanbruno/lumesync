import { describe, expect, it } from 'vitest';
import { normalizeOrigin, shouldGrantAppPermission } from './permissionPolicy';

const trusted = new Set(['https://lumesocial.online']);

describe('desktop permission policy', () => {
  it('allows call permissions only for the trusted Lume origin', () => {
    expect(shouldGrantAppPermission('media', 'https://lumesocial.online/channels/@me', trusted)).toBe(true);
    expect(shouldGrantAppPermission('display-capture', 'https://lumesocial.online/', trusted)).toBe(true);
    expect(shouldGrantAppPermission('media', 'https://evil.example/', trusted)).toBe(false);
  });

  it('rejects unrelated powerful permissions', () => {
    expect(shouldGrantAppPermission('geolocation', 'https://lumesocial.online/', trusted)).toBe(false);
    expect(shouldGrantAppPermission('usb', 'https://lumesocial.online/', trusted)).toBe(false);
  });

  it('normalizes URLs to their origin', () => {
    expect(normalizeOrigin('https://lumesocial.online/login')).toBe('https://lumesocial.online');
    expect(normalizeOrigin('not a url')).toBeNull();
  });
});

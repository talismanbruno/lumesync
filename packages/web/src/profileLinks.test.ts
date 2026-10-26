import { describe, expect, it } from 'vitest';
import { normalizeProfileSocialLink, normalizeProfileSocialLinks, parseProfileSocialLinks } from '@backspace/shared';

describe('public social profile links', () => {
  it.each([
    ['x', '@lume', 'https://x.com/lume'],
    ['x', 'https://twitter.com/lume?x=1', 'https://x.com/lume'],
    ['spotify', 'https://open.spotify.com/user/lume?si=test', 'https://open.spotify.com/user/lume'],
    ['steam', '76561198000000000', 'https://steamcommunity.com/profiles/76561198000000000'],
    ['steam', 'lume', 'https://steamcommunity.com/id/lume'],
    ['epicgames', 'Lume Player', 'Lume Player'],
    ['youtube', '@lume', 'https://youtube.com/@lume'],
    ['bluesky', 'lume.bsky.social', 'https://bsky.app/profile/lume.bsky.social'],
  ])('normalizes %s profiles', (platform, value, expected) => {
    expect(normalizeProfileSocialLink({ platform, value })?.value).toBe(expected);
  });
  it.each([
    ['x', 'javascript:alert(1)'], ['x', 'https://x.com.evil.test/lume'],
    ['x', 'https://user:password@x.com/lume'], ['x', 'https://x.com/home'],
    ['x', 'https://x.com/lume/status/123'], ['spotify', 'https://open.spotify.com/track/abc'],
    ['website', 'file:///secret'], ['website', 'https://127.0.0.1'], ['website', 'https://a.local'],
    ['epicgames', '<script>'], ['steam', 'https://steamcommunity.com/id/lume/friends'],
  ])('rejects unsafe/non-profile %s input', (platform, value) => {
    expect(normalizeProfileSocialLink({ platform, value })).toBeNull();
  });
  it('rejects duplicates and oversized payloads, and permits explicit clearing', () => {
    const link = { platform: 'x', value: '@lume' };
    expect(normalizeProfileSocialLinks([link, link])).toBeNull();
    expect(normalizeProfileSocialLinks(Array(12).fill(link))).toBeNull();
    expect(normalizeProfileSocialLinks(null)).toEqual([]);
    expect(parseProfileSocialLinks('{bad')).toEqual([]);
  });
});

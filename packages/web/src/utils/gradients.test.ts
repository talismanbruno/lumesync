import { describe, expect, it } from 'vitest';
import { AVATAR_GRADIENT_MAP, getAvatarGradient } from './gradients';

describe('custom avatar colors', () => {
  it.each([
    ['#ffffff', '#000000'], ['#000000', '#ffffff'],
    ['#ffff00', '#000000'], ['#243A80', '#ffffff'],
  ])('renders the chosen color %s with a readable initial', (color, foreground) => {
    const appearance = getAvatarGradient('user', 'Name', color);
    expect(appearance.from).toBe(color);
    expect(appearance.to).toBe(color);
    expect(appearance.foreground).toBe(foreground);
  });
  it('preserves existing presets and falls back safely for malformed colors', () => {
    expect(getAvatarGradient('user', 'Name', 'sky')).toEqual(AVATAR_GRADIENT_MAP.sky);
    for (const value of ['#fff', 'red', 'constructor', 'url(https://example.com)']) {
      expect(getAvatarGradient('user', 'Name', value)).toEqual(getAvatarGradient('user', 'Name'));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { getProfileThemeColors, getProfileThemeStyle } from './profileTheme';

describe('two-color profile themes', () => {
  it('uses the same two saved colors even when the banner has a different accent', () => {
    const user = { accentColor: '#ff0000', customization: { themeColor: '#000000', themeSecondaryColor: '#123456' } };
    expect(getProfileThemeColors(user)).toEqual({ primary: '#000000', secondary: '#123456' });
    expect(getProfileThemeStyle(user).backgroundImage).toBe('linear-gradient(180deg, #000000 0%, #123456 100%)');
    expect(user.accentColor).toBe('#ff0000');
  });
  it('changes the actual card surface when only the secondary color changes', () => {
    const before = getProfileThemeStyle({ customization: { themeColor: '#000000', themeSecondaryColor: '#123456' } });
    const after = getProfileThemeStyle({ customization: { themeColor: '#000000', themeSecondaryColor: '#361234' } });
    expect(after.backgroundImage).not.toBe(before.backgroundImage);
    expect(after.backgroundImage).toContain('#361234');
  });
  it('preserves saved legacy accents as the second color and leaves uncustomized profiles alone', () => {
    expect(getProfileThemeColors({ accentColor: '#123456' })).toEqual({ primary: '#111218', secondary: '#123456' });
    expect(getProfileThemeStyle({})).toEqual({});
    expect(getProfileThemeStyle({ customization: { themeColor: null, themeSecondaryColor: null } })).toEqual({});
  });
  it('keeps bright color choices dark enough for light profile text', () => {
    const result = getProfileThemeStyle({ customization: { themeColor: '#ffffff', themeSecondaryColor: '#ffff00' } });
    const stops = result.backgroundImage!.match(/#[0-9a-f]{6}/g)!;
    expect(stops).toHaveLength(2);
    for (const stop of stops) {
      const channels = [1, 3, 5].map(offset => parseInt(stop.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      const luminance = .2126 * channels[0]! + .7152 * channels[1]! + .0722 * channels[2]!;
      expect(1.05 / (luminance + .05)).toBeGreaterThan(12);
    }
  });
  it('never places malformed color data in a CSS gradient', () => {
    const user = { customization: { themeColor: 'url(https://example.com)', themeSecondaryColor: 'red' } };
    expect(getProfileThemeStyle(user)).toEqual({});
  });
});

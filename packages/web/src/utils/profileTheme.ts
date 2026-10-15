import type { CSSProperties } from 'react';
import type { ProfileCustomization } from '@backspace/shared';

interface ThemedProfile {
  customization?: ProfileCustomization | null;
  accentColor?: string | null;
}

const hex = (value: string | null | undefined): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

export function getProfileThemeColors(user: ThemedProfile) {
  const primary = hex(user.customization?.themeColor) ? user.customization.themeColor : '#111218';
  const secondary = hex(user.customization?.themeSecondaryColor) ? user.customization.themeSecondaryColor
    : hex(user.accentColor) ? user.accentColor : primary;
  return { primary, secondary };
}

/** Keep the selected hue while giving profile text a consistently dark surface. */
function profileShade(color: string): string {
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  const luminance = (scale: number) => channels.reduce((sum, channel, index) => {
    const normalized = channel * scale / 255;
    const linear = normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    return sum + linear * [ .2126, .7152, .0722 ][index]!;
  }, 0);
  if (luminance(1) <= .035) return color;
  let low = 0, high = 1;
  for (let index = 0; index < 10; index++) {
    const midpoint = (low + high) / 2;
    if (luminance(midpoint) <= .035) low = midpoint; else high = midpoint;
  }
  return `#${channels.map(channel => Math.floor(channel * low).toString(16).padStart(2, '0')).join('')}`;
}

export function getProfileThemeStyle(user: ThemedProfile): CSSProperties {
  if (!hex(user.customization?.themeColor) && !hex(user.customization?.themeSecondaryColor) && !hex(user.accentColor)) return {};
  const { primary, secondary } = getProfileThemeColors(user);
  return {
    backgroundColor: primary,
    backgroundImage: `linear-gradient(180deg, ${profileShade(primary)} 0%, ${profileShade(secondary)} 100%)`,
  };
}

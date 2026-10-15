import { isProfileFlagCountry, type ProfileFlagCountry } from './flagCountries.js';
export * from './flagCountries.js';
export const PROFILE_NAME_FONTS = ['gg sans', 'Sakura', 'Jellybean', 'Tempo', 'Journal', 'Modern', 'Medieval', '8Bit', 'Vampyre', 'Munro', 'Monkey Bars', 'Mainframe', 'Headbang', 'Delicious Handrawn', 'Fraunces', 'Corinthia'] as const;
export const PROFILE_NAME_EFFECTS = ['solid', 'gradient', 'neon', 'toon', 'pop', 'glow', 'prism', 'gummy'] as const;
export type ProfileNameEffect = typeof PROFILE_NAME_EFFECTS[number];
export interface ProfileCustomization {
  bannerFlag?: ProfileFlagCountry | null;
  nameplateFlag?: ProfileFlagCountry | null;
  avatarDecorationId?: string | null;
  nameplateId?: string | null;
  profileEffectId?: string | null;
  profileFrameId?: string | null;
  nameFont?: typeof PROFILE_NAME_FONTS[number] | null;
  nameEffect?: ProfileNameEffect | null;
  nameColors?: string[];
  themeColor?: string | null;
}
export interface CosmeticLayer {
  src: string;
  duration: number;
  start: number;
  loop: boolean;
  loopDelay: number;
  zIndex: number;
  randomizedSources?: string[];
}
export interface CosmeticFrameLayer {
  id: string;
  src: string;
  type: string;
  order: 'front' | 'back';
  anchor: 'top' | 'bottom' | 'center';
  responsive: boolean;
}
export interface CosmeticItem {
  id: string;
  type: 0 | 1 | 2 | 3;
  name: string;
  category: string;
  categoryId: string;
  description: string;
  staticSrc?: string;
  animatedSrc?: string;
  layers?: CosmeticLayer[];
  frameLayers?: CosmeticFrameLayer[];
  frameWidth?: number;
  overflowTop?: number;
  overflowBottom?: number;
  overflowHorizontal?: number;
}
export interface CustomizationCatalog { items: CosmeticItem[]; }

/** IDs and colors only: profile data can never supply executable styles or asset URLs. */
export function isProfileCustomization(value: unknown): value is ProfileCustomization | null {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const keys = new Set(['avatarDecorationId', 'nameplateId', 'profileEffectId', 'profileFrameId', 'nameFont', 'nameEffect', 'nameColors', 'themeColor', 'bannerFlag', 'nameplateFlag']);
  if (Object.keys(obj).some(key => !keys.has(key))) return false;
  if (obj.bannerFlag != null && !isProfileFlagCountry(obj.bannerFlag)) return false;
  if (obj.nameplateFlag != null && !isProfileFlagCountry(obj.nameplateFlag)) return false;
  for (const key of ['avatarDecorationId', 'nameplateId', 'profileEffectId', 'profileFrameId']) {
    if (obj[key] != null && (typeof obj[key] !== 'string' || !/^\d{1,24}$/.test(obj[key] as string))) return false;
  }
  if (obj.nameFont != null && !(PROFILE_NAME_FONTS as readonly unknown[]).includes(obj.nameFont)) return false;
  if (obj.nameEffect != null && !(PROFILE_NAME_EFFECTS as readonly unknown[]).includes(obj.nameEffect)) return false;
  const hex = (color: unknown) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  if (obj.themeColor != null && !hex(obj.themeColor)) return false;
  if (obj.nameColors !== undefined && (!Array.isArray(obj.nameColors) || obj.nameColors.length > 5 || !obj.nameColors.every(hex))) return false;
  return true;
}
export function parseProfileCustomization(value: unknown): ProfileCustomization | null {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    return isProfileCustomization(parsed) ? parsed : null;
  } catch { return null; }
}

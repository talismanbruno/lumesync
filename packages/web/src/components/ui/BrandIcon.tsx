import type { ProfileLinkPlatform } from '@backspace/shared';
import { BRAND_ICON_PATHS } from './brandIcons/paths';

/** Original brand silhouettes, independent of installed fonts and operating system. */
export function BrandIcon({ platform, size = 14, className = '' }: { platform: ProfileLinkPlatform; size?: number; className?: string }) {
  const iconSize = platform === 'x' ? Math.min(size, 10) : size;
  if (platform === 'website') return <svg data-brand="website" aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" className={'shrink-0 ' + className}>
    <circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" />
  </svg>;
  return <svg data-brand={platform} aria-hidden="true" focusable="false" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" className={'shrink-0 ' + className}>
    <path d={BRAND_ICON_PATHS[platform]} />
  </svg>;
}

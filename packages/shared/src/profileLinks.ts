export const PROFILE_LINK_PLATFORMS = [
  { id: 'x', label: 'X', placeholder: '@usuario ou https://x.com/usuario' },
  { id: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/user/seu-perfil' },
  { id: 'steam', label: 'Steam', placeholder: 'https://steamcommunity.com/id/seu-perfil' },
  { id: 'epicgames', label: 'Epic Games', placeholder: 'Seu nome de exibição na Epic' },
  { id: 'instagram', label: 'Instagram', placeholder: '@usuario' },
  { id: 'youtube', label: 'YouTube', placeholder: '@canal ou link do canal' },
  { id: 'twitch', label: 'Twitch', placeholder: 'Seu canal' },
  { id: 'github', label: 'GitHub', placeholder: 'Seu usuário' },
  { id: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
  { id: 'bluesky', label: 'Bluesky', placeholder: 'usuario.bsky.social' },
  { id: 'website', label: 'Site pessoal', placeholder: 'https://seusite.com' },
] as const;

export type ProfileLinkPlatform = typeof PROFILE_LINK_PLATFORMS[number]['id'];
export interface ProfileSocialLink { platform: ProfileLinkPlatform; value: string; }

function profilePath(platform: ProfileLinkPlatform, input: string): string | null {
  const short = input.replace(/^@/, '');
  if (platform === 'x' && /^[a-z\d_]{1,15}$/i.test(short) && !/^(home|explore|settings|intent|search|help|i)$/i.test(short)) return '/' + short;
  if (platform === 'instagram' && /^[a-z\d_.]{1,30}$/i.test(short)) return '/' + short;
  if (platform === 'twitch' && /^[a-z\d_]{1,25}$/i.test(short)) return '/' + short;
  if (platform === 'github' && /^[a-z\d-]{1,39}$/i.test(short)) return '/' + short;
  if (platform === 'tiktok' && /^[a-z\d_.]{1,32}$/i.test(short)) return '/@' + short;
  if (platform === 'youtube' && /^[\p{L}\p{N}_.-]{1,100}$/u.test(short)) return '/@' + encodeURIComponent(short);
  if (platform === 'bluesky' && /^[a-z\d.:-]{3,253}$/i.test(short)) return '/profile/' + short;
  if (platform === 'steam') {
    if (/^\d{17}$/.test(short)) return '/profiles/' + short;
    if (/^[a-z\d_-]{1,64}$/i.test(short)) return '/id/' + short;
  }
  return null;
}

const hosts: Partial<Record<ProfileLinkPlatform, string>> = {
  x: 'x.com', spotify: 'open.spotify.com', steam: 'steamcommunity.com',
  instagram: 'instagram.com', youtube: 'youtube.com', twitch: 'twitch.tv',
  github: 'github.com', tiktok: 'tiktok.com', bluesky: 'bsky.app',
};

export function normalizeProfileSocialLink(input: unknown): ProfileSocialLink | null {
  if (!input || typeof input !== 'object') return null;
  const { platform, value } = input as Record<string, unknown>;
  if (!PROFILE_LINK_PLATFORMS.some(item => item.id === platform) || typeof value !== 'string') return null;
  const kind = platform as ProfileLinkPlatform;
  const text = value.trim();
  if (!text || text.length > 512 || /[\u0000-\u001f\u007f]/.test(text)) return null;
  // Epic does not supply a universal public-profile URL; show the entered display
  // name instead of inventing a profile link or implying account verification.
  if (kind === 'epicgames') return /^[\p{L}\p{N} ._-]{1,32}$/u.test(text) ? { platform: kind, value: text } : null;
  if (/\s/.test(text)) return null;
  if (!text.includes('://') && kind !== 'website') {
    const path = profilePath(kind, text);
    if (path && hosts[kind]) return { platform: kind, value: 'https://' + hosts[kind] + path };
  }
  let url: URL;
  try { url = new URL(text.includes('://') ? text : 'https://' + text); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (kind === 'website') {
    if (!/^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(host) || host.endsWith('.localhost') || host.endsWith('.local') || /^[\d.]+$/.test(host)) return null;
    url.protocol = 'https:';
    return url.href.length <= 512 ? { platform: kind, value: url.href } : null;
  }
  if (host !== hosts[kind] && !(kind === 'x' && host === 'twitter.com')) return null;
  let pathname: string;
  try { pathname = decodeURIComponent(url.pathname).replace(/\/$/, ''); } catch { return null; }
  let path: string | null = null;
  if (kind === 'spotify' && /^\/user\/[a-z\d_.-]{1,128}$/i.test(pathname)) path = pathname;
  else if (kind === 'steam' && /^\/(?:id\/[a-z\d_-]{1,64}|profiles\/\d{17})$/i.test(pathname)) path = pathname;
  else if (kind === 'youtube' && /^\/channel\/[a-z\d_-]{1,64}$/i.test(pathname)) path = pathname;
  else if (kind === 'bluesky' && /^\/profile\/[a-z\d.:-]{3,253}$/i.test(pathname)) path = pathname;
  else if (kind === 'youtube' || kind === 'tiktok') path = pathname.startsWith('/@') ? profilePath(kind, pathname.slice(2)) : null;
  else if (/^\/[^/]+$/.test(pathname)) path = profilePath(kind, pathname.slice(1));
  const normalized = path ? 'https://' + hosts[kind] + path : '';
  return normalized && normalized.length <= 512 ? { platform: kind, value: normalized } : null;
}

export function normalizeProfileSocialLinks(input: unknown): ProfileSocialLink[] | null {
  if (input === null) return [];
  if (!Array.isArray(input) || input.length > PROFILE_LINK_PLATFORMS.length) return null;
  const links: ProfileSocialLink[] = [];
  const seen = new Set<ProfileLinkPlatform>();
  for (const raw of input) {
    const link = normalizeProfileSocialLink(raw);
    if (!link || seen.has(link.platform)) return null;
    seen.add(link.platform); links.push(link);
  }
  return links;
}

export function parseProfileSocialLinks(input: unknown): ProfileSocialLink[] {
  try { return normalizeProfileSocialLinks(typeof input === 'string' ? JSON.parse(input) : input) ?? []; }
  catch { return []; }
}

export function profileLinkLabel(link: ProfileSocialLink): string {
  if (link.platform === 'epicgames') return link.value;
  try {
    const url = new URL(link.value);
    if (link.platform === 'website') return url.hostname;
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '').replace(/^@/, '');
  } catch { return ''; }
}

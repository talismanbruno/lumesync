import { PROFILE_LINK_PLATFORMS, parseProfileSocialLinks, profileLinkLabel } from '@backspace/shared';
import type { User } from '@backspace/shared';
import { BrandIcon } from './BrandIcon';

export function ProfileSocialLinks({ user }: { user: Pick<User, 'socialLinks'> }) {
  const links = parseProfileSocialLinks(user.socialLinks);
  if (!links.length) return null;
  return <div aria-label="Redes sociais" className="flex flex-wrap gap-2 mt-3">
    {links.map(link => {
      const label = PROFILE_LINK_PLATFORMS.find(platform => platform.id === link.platform)!.label;
      const content = <><BrandIcon platform={link.platform} /><span className="truncate max-w-[140px]">{profileLinkLabel(link)}</span></>;
      const className = 'inline-flex items-center gap-2 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs';
      return link.platform === 'epicgames'
        ? <span key={link.platform} title={label} aria-label={label + ': ' + link.value} className={className + ' select-text'}>{content}</span>
        : <a key={link.platform} title={label} className={className + ' hover:bg-white/[0.08] transition-colors'} href={link.value} target="_blank" rel="noopener noreferrer" aria-label={`${label}: ${profileLinkLabel(link)}`}>{content}<span aria-hidden="true">↗</span></a>;
    })}
  </div>;
}

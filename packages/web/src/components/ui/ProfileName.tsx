import type { ReactNode } from 'react';
import type { User } from '@backspace/shared';
import { useAuthStore } from '../../stores/authStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { canonicalUserKey, isSelf } from '../../utils/identity';
import { getNameStyle } from '../../utils/nameAppearance';

/** Shared identity color, subscribed narrowly so presence changes do not redraw names. */
export function ProfileName({ user, children }: { user?: Partial<User> | null; children: ReactNode }) {
  const key = user?.id ? canonicalUserKey({ ...user, id: user.id }) : null;
  const cachedColor = useSpaceStore((state) => key ? state.userViews?.get(key)?.user.nameColor : undefined);
  const selfColor = useAuthStore((state) => user?.id && isSelf({ ...user, id: user.id, username: user.username ?? '' }, state.user) ? state.user?.nameColor : undefined);
  return <span style={getNameStyle({ nameColor: selfColor !== undefined ? selfColor : cachedColor !== undefined ? cachedColor : user?.nameColor })}>{children}</span>;
}

import type { User } from '@backspace/shared';
import { isPioneer } from '../../utils/pioneer';
import { VerifiedBadge } from './VerifiedBadge';
import { PioneerBadge } from './PioneerBadge';
import { BetaContributorBadge } from './BetaContributorBadge';

type BadgeUser = Pick<User, 'isAdmin' | 'isPioneer' | 'homeInstance' | 'isBetaContributor' | 'isDeleted'>;

/** Keep recognition marks at one size and spacing across user nameplates. */
export function UserBadges({ user, size = 14 }: { user: BadgeUser; size?: number }) {
  const pioneer = isPioneer(user);
  const contributor = user.isBetaContributor && !user.isDeleted;
  if (!user.isAdmin && !pioneer && !contributor) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 align-middle leading-none">
      {user.isAdmin && <VerifiedBadge size={size} />}
      {pioneer && <PioneerBadge size={size} />}
      {contributor && <BetaContributorBadge size={size} />}
    </span>
  );
}

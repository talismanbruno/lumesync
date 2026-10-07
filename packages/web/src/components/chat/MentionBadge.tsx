import { getNameStyle } from '../../utils/nameAppearance';
import React from 'react';
import type { User } from '@backspace/shared';
import { useSpaceStore } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { useCanonicalUserView } from '../../utils/userViewLookup';

interface MentionBadgeProps {
  userId: string;
}

export const MentionBadge = React.memo(function MentionBadge({ userId }: MentionBadgeProps) {
  const members = useSpaceStore((s) => s.members);
  const openUserProfile = useUIStore((s) => s.openUserProfile);

  const member = members.find((m) => m.userId === userId);

  const _FALLBACK_USER = { id: '', username: '', createdAt: 0, isAdmin: false, replicatedInstances: [] } as unknown as User;
  const canonicalMemberUser = useCanonicalUserView(member?.user ?? _FALLBACK_USER);
  const memberUser = member ? canonicalMemberUser : null;

  let displayName: string;
  let color: string;

  if (member && memberUser) {
    displayName = memberUser.displayName ?? memberUser.username;
    color = memberUser.nameColor === 'gold' ? '#ffdf80' : getNameStyle(memberUser).color as string;
  } else {
    displayName = 'Unknown User';
    color = '#a0a0aa'; // text-secondary fallback
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!member || !memberUser) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openUserProfile(memberUser, {
      top: Math.min(rect.top, window.innerHeight - 450),
      left: rect.right + 8,
    });
  };

  // Build inline styles: role-colored text with tinted background
  const bgColor = color + '1a'; // ~10% opacity hex

  return (
    <span
      onClick={handleClick}
      className="inline-flex items-center rounded-[3px] px-[2px] font-medium cursor-pointer transition-colors hover:brightness-125"
      style={{ ...getNameStyle(memberUser ?? {}), backgroundColor: bgColor }}
    >
      @{displayName}
    </span>
  );
});

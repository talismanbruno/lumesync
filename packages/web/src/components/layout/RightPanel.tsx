import React from 'react';
import { useLocation } from 'react-router-dom';
import { MemberSidebar } from './MemberSidebar';
import { ActivityPanel } from './ActivityPanel';
import { DmRosterPanel } from './DmRosterPanel';
import { useUIStore } from '../../stores/uiStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useChatStore } from '../../stores/chatStore';

export function RightPanel() {
  const { pathname } = useLocation();
  const showDms = useUIStore((s) => s.showDms);
  const memberListOpen = useUIStore((s) => s.memberListOpen);
  const currentSpaceId = useSpaceStore((s) => s.currentSpaceId);
  const dmChannels = useSpaceStore((s) => s.dmChannels);
  const currentChannelId = useChatStore((s) => s.currentChannelId);

  if (pathname === '/explore') return null;
  // Presence belongs to Friends. Conversations only show their own roster.
  if (showDms || !currentSpaceId) {
    if (!currentChannelId) return <ActivityPanel />;
    const dmChannel = dmChannels.find((dm) => dm.id === currentChannelId);
    const isGroupDm = !!dmChannel?.ownerId && dmChannel.members.length > 2;
    if (isGroupDm && memberListOpen) {
      return <DmRosterPanel />;
    }
    return null;
  }

  return <MemberSidebar />;
}

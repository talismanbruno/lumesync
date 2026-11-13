import { ProfileName } from '../ui/ProfileName';
import { startDmCall } from '../../utils/dmActions';
import { t as uiText } from '../../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSpaceStore } from '../../stores/spaceStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { CompactCallPanel } from '../voice/CompactCallPanel';
import { ServerVoiceView } from '../voice/ServerVoiceView';
import { FriendsPage } from '../chat/FriendsPage';
import { ExplorePage } from '../chat/ExplorePage';
import { Avatar } from '../ui/Avatar';
import { AvatarStack } from '../ui/AvatarStack';
import { useVoiceStore } from '../../stores/voiceStore';
import { wsSend } from '../../hooks/useWebSocket';
import { MemberListToggleButton } from './MemberListToggleButton';
import { TransferIndicator } from './TransferIndicator';
import { isSelf, parseFederatedUsername, isFederationGlobeApplicable } from '../../utils/identity';
import { formatDmHeaderName, formatDmInputLabel, isDeletedPartnerDm } from '../../utils/dmFormatters';
import { DmDeletedNotice } from '../chat/DmDeletedNotice';
import { useCanonicalUserView } from '../../utils/userViewLookup';
import type { User } from '@backspace/shared';
import { Tooltip } from '../ui/Tooltip';
import { OrbitalIcon } from '../ui/OrbitalIcon';
import { SearchPopover } from '../chat/SearchPopover';
import { isDmChannel, getChannelOrigin } from '../../stores/spaceStore';

export function MainContent() {
  // 1. ALL HOOKS AT THE TOP
  const channels = useSpaceStore((s) => s.channels);
  const currentChannelId = useChatStore((s) => s.currentChannelId);
  const currentSpaceId = useSpaceStore((s) => s.currentSpaceId);
  const showDms = useUIStore((s) => s.showDms);
  const location = useLocation();
  const isExplorePage = location.pathname === '/explore';
  const activeDmCall = useVoiceStore((s) => s.activeDmCall);
  const outgoingCall = useVoiceStore((s) => s.outgoingCall);
  const dmChannels = useSpaceStore((s) => s.dmChannels);
  const authUser = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);

  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null);

  // Resolve the DM header's "first other" member through the canonical view
  // cache. The hook must be called unconditionally at the component top, so we
  // pass a fallback when there is no current DM channel or 1-on-1 partner.
  const _dmChannel = dmChannels.find(dm => dm.id === currentChannelId);
  const _rawFirstOther = _dmChannel?.members.filter(m => !isSelf(m, authUser))[0] ?? null;
  const _FALLBACK_USER = { id: '', username: '', createdAt: 0, isAdmin: false, replicatedInstances: [] } as unknown as User;
  const _canonicalFirstOther = useCanonicalUserView(_rawFirstOther ?? _FALLBACK_USER);

  // Reset search when channel changes
  useEffect(() => {
    setSearchOpen(false);
  }, [currentChannelId]);

  // 2. LOGIC AND EARLY RETURNS
  const channel = channels.find(c => c.id === currentChannelId);
  const isVoiceChannel = channel?.type === 'voice';

  if (showDms || isExplorePage || !currentSpaceId) {
    if (!currentChannelId) {
      if (isExplorePage) return <ExplorePage />;
      return <FriendsPage />;
    }

    const dmChannel = dmChannels.find(dm => dm.id === currentChannelId);
    const otherMembers = dmChannel?.members.filter(m => !isSelf(m, authUser)) ?? [];
    const isGroupDm = !!dmChannel?.ownerId;
    // Use the canonicalized view of the 1-on-1 partner (resolved above the
    // conditional so the hook is called unconditionally).
    const firstOther = _rawFirstOther ? _canonicalFirstOther : (otherMembers[0] ?? null);
    const { baseName: firstBaseName } = parseFederatedUsername(firstOther?.username ?? '');
    // Group DMs route through `formatDmHeaderName` (honors `dm.name`, falls
    // back to joined member names); 1-on-1 DMs keep the canonical-view path
    // so replicated aliases still surface the home-instance display name.
    const dmName = isGroupDm && dmChannel
      ? formatDmHeaderName(dmChannel, authUser)
      : (firstOther?.displayName ?? (firstBaseName || 'Direct Message'));
    // Message-input placeholder — groups use `formatDmInputLabel` which
    // collapses unnamed groups to "the group" so the textarea doesn't render
    // "Message #Alice, Bob, Charlie, Dave". 1-on-1 reuses the canonical
    // `dmName` so the placeholder stays aligned with the header (the utility
    // resolves the raw partner; on replicated aliases the canonical view
    // can disagree).
    const dmInputPlaceholder = isGroupDm && dmChannel
      ? `Message ${formatDmInputLabel(dmChannel, authUser)}`
      : dmChannel
        ? `Message @${dmName}`
        : undefined;
    const dmPartnerDeleted = dmChannel ? isDeletedPartnerDm(dmChannel, authUser) : false;

    const isInDmCall = activeDmCall?.dmChannelId === currentChannelId;
    const isCallingThisDm = outgoingCall?.dmChannelId === currentChannelId;

    const handleStartVoiceCall = () => {
      if (!currentChannelId) return;
      try { startDmCall(currentChannelId); }
      catch (error) { useUIStore.getState().addToast(error instanceof Error ? error.message : 'Não foi possível iniciar a chamada.', 'warning'); }
    };

    const handleCancelCall = () => {
      if (!currentChannelId) return;
      useVoiceStore.getState().setOutgoingCall(null);
      const { federatedCallId, callOrigin } = useVoiceStore.getState();
      const origin = callOrigin || getChannelOrigin(currentChannelId);
      wsSend({ type: 'dm_call_end', dmChannelId: currentChannelId, federatedCallId }, origin);
    };

    return (
      <div className="flex-1 flex flex-col bg-surface-chat min-w-0 min-h-0 relative">
        {isCallingThisDm && (
          <div className="bg-status-online/10 border-b border-status-online/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-status-online animate-pulse">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <span className="text-status-online text-sm font-medium">{uiText("Calling ")}{dmName}...</span>
            </div>
            <button
              onClick={handleCancelCall}
              className="px-3 py-1 bg-accent-rose hover:bg-accent-rose/80 text-white text-xs font-medium rounded transition-colors"
            >
              {uiText("Cancel")}</button>
          </div>
        )}
        <div className="h-14 px-5 flex items-center justify-between border-b border-border-hard flex-shrink-0 z-10 bg-surface-chat">
          <div className="flex items-center gap-[10px] min-w-0">
            {isGroupDm ? (
              <div
                onClick={() => openModal('groupDmSettings', { dmChannelId: currentChannelId, initialTab: 'overview' })}
                className="flex-shrink-0 cursor-pointer"
                aria-label={uiText("Open group settings")}
              >
                <AvatarStack members={otherMembers} size={32} border="chat" iconUrl={dmChannel?.icon} />
              </div>
            ) : (
              <OrbitalIcon name="chat" size={20} className="text-txt-tertiary flex-shrink-0" />
            )}
            {isGroupDm ? (
              <span
                onClick={() => openModal('groupDmSettings', { dmChannelId: currentChannelId, initialTab: 'overview' })}
                className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary truncate cursor-pointer"
              >
                <ProfileName user={isGroupDm ? undefined : firstOther}>{dmName}</ProfileName>
              </span>
            ) : (
              <span className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary truncate"><ProfileName user={isGroupDm ? undefined : firstOther}>{dmName}</ProfileName></span>
            )}
            {!isGroupDm && firstOther && isFederationGlobeApplicable(firstOther) && (
              <Tooltip content={firstOther.username} position="bottom">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary/80 flex-shrink-0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </Tooltip>
            )}
            {isGroupDm && (() => {
              const federatedMembers = (dmChannel?.members ?? []).filter(m => isFederationGlobeApplicable(m));
              if (federatedMembers.length === 0) return null;
              return (
                <Tooltip content={federatedMembers.map(m => m.username).join(', ')} position="bottom">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary/80 flex-shrink-0">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                </Tooltip>
              );
            })()}
            {isGroupDm && (
              <span
                onClick={() => openModal('groupDmSettings', { dmChannelId: currentChannelId, initialTab: 'members' })}
                className="text-xs text-txt-tertiary flex-shrink-0 cursor-pointer"
              >
                ({dmChannel?.members.length} {uiText(" members)")}</span>
            )}
            {isGroupDm && (
              <button
                onClick={() => openModal('groupDmSettings', { dmChannelId: currentChannelId, initialTab: 'overview' })}
                className="w-7 h-7 flex items-center justify-center text-txt-tertiary hover:text-txt-primary transition-colors rounded-[6px] hover:bg-interactive-hover flex-shrink-0"
                title={uiText("Group Settings")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
                </svg>
              </button>
            )}
          </div>
          <div className="lume-header-actions flex items-center gap-1 flex-shrink-0">
            {!isInDmCall && <>
            <button
              onClick={handleStartVoiceCall}
              disabled={!!outgoingCall || !!activeDmCall}
              className="w-8 h-8 flex items-center justify-center text-txt-tertiary hover:text-txt-primary transition-colors rounded-[6px] hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed"
              title={uiText("Start Voice Call")}
            >
              <OrbitalIcon name="call" size={22} />
            </button>
            <button
              onClick={handleStartVoiceCall}
              disabled={!!outgoingCall || !!activeDmCall}
              className="w-8 h-8 flex items-center justify-center text-txt-tertiary hover:text-txt-primary transition-colors rounded-[6px] hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed"
              title={uiText("Start Video Call")}
            >
              <OrbitalIcon name="video" size={22} />
            </button>
            </>}
            <button
              onClick={() => openModal('addDmMember', { dmChannelId: currentChannelId })}
              className="w-8 h-8 flex items-center justify-center text-txt-tertiary hover:text-txt-primary transition-colors rounded-[6px] hover:bg-interactive-hover"
              title={uiText("Add Friends to DM")}
            >
              <OrbitalIcon name="personAdd" size={22} />
            </button>
            <button
              ref={searchButtonRef}
              onClick={() => setSearchOpen(!searchOpen)}
              className={`w-8 h-8 flex items-center justify-center transition-colors rounded-[6px] ${searchOpen ? 'text-txt-primary bg-interactive-active' : 'text-txt-tertiary hover:text-txt-primary hover:bg-interactive-hover'}`}
              title={uiText("Search")}
            >
              <OrbitalIcon name="search" size={22} />
            </button>
            <TransferIndicator />
            {isGroupDm && dmChannel.members.length > 2 && <><div className="w-[1px] h-5 bg-border-soft mx-1" /><MemberListToggleButton /></>}
          </div>
        </div>
        <CompactCallPanel key={currentChannelId} active={isInDmCall} roomId={currentChannelId} privateCall />
        <div className="relative flex flex-1 min-h-0 min-w-0 flex-col">
          <MessageList channelId={currentChannelId} jumpToMessageId={jumpToMessageId} onJumpComplete={() => setJumpToMessageId(null)} />
          {dmPartnerDeleted
            ? <DmDeletedNotice />
            : <MessageInput channelId={currentChannelId} channelName={`@${dmName}`} placeholder={dmInputPlaceholder} />}
        </div>
        <SearchPopover
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          anchorRef={searchButtonRef}
          channelId={currentChannelId}
          isDm={true}
          onJumpToMessage={(id) => { setJumpToMessageId(id); setSearchOpen(false); }}
        />
      </div>
    );
  }

  if (!currentChannelId || !channel) {
    return (
      <div className="flex-1 flex flex-col bg-surface-chat relative">
        <div className="h-14 px-5 flex items-center justify-between border-b border-border-hard">
          <span className="text-txt-tertiary">{uiText("Select a channel")}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <TransferIndicator />
            <MemberListToggleButton />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-txt-tertiary">
          <p>{uiText("Select a text or voice channel to get started")}</p>
        </div>
      </div>
    );
  }

  if (isVoiceChannel) {
    return <ServerVoiceView key={currentChannelId} channelId={currentChannelId} channelName={channel.name} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-chat min-w-0 relative">
      <div className="h-14 px-5 flex items-center justify-between border-b border-border-hard flex-shrink-0 z-10 bg-surface-chat">
        <div className="flex items-center gap-[10px] min-w-0">
          <span className="text-[20px] font-medium text-txt-tertiary flex-shrink-0 leading-none">#</span>
          <span className="font-bold text-[15px] tracking-[-0.02em] text-txt-primary truncate leading-tight">{channel.name}</span>
          {channel.topic && (
            <>
              <div className="w-[1px] h-5 bg-border-soft mx-2" />
              <span className="text-[13px] text-txt-tertiary truncate leading-tight">{channel.topic}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            ref={searchButtonRef}
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-8 h-8 flex items-center justify-center transition-colors rounded-[6px] ${searchOpen ? 'text-txt-primary bg-interactive-active' : 'text-txt-tertiary hover:text-txt-primary hover:bg-interactive-hover'}`}
            title={uiText("Search")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.707 20.293l-5.395-5.395A7.457 7.457 0 0018 10.5 7.5 7.5 0 1010.5 18c1.575 0 3.027-.486 4.228-1.31l5.476 5.476a.997.997 0 001.414 0l.089-.089a1 1 0 000-1.414l.001-.37zM10.5 16a5.5 5.5 0 110-11 5.5 5.5 0 010 11z" />
            </svg>
          </button>
          <TransferIndicator />
          <div className="w-[1px] h-5 bg-border-soft mx-1" />
          <MemberListToggleButton />
        </div>
      </div>
      <MessageList channelId={currentChannelId} jumpToMessageId={jumpToMessageId} onJumpComplete={() => setJumpToMessageId(null)} />
      <MessageInput channelId={currentChannelId} channelName={channel.name} />
      <SearchPopover
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        anchorRef={searchButtonRef}
        channelId={currentChannelId}
        isDm={false}
        onJumpToMessage={(id) => { setJumpToMessageId(id); setSearchOpen(false); }}
      />
    </div>
  );
}

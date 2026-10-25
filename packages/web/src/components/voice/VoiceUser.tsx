import { ProfileName } from '../ui/ProfileName';
import { t as uiText } from '../../i18n';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Avatar } from '../ui/Avatar';
import { useVoiceStore } from '../../stores/voiceStore';
import { useContextMenuStore } from '../../stores/contextMenuStore';
import { buildVoiceParticipantMenuItems } from './voiceMenuItems';
import { useSpaceStore } from '../../stores/spaceStore';
import { useVoiceParticipantMeta } from '../../hooks/useVoiceParticipantMeta';
import type { UserTile } from '../../hooks/useLiveKit';
import { VoiceStatusBadge } from './VoiceStatusBadge';

interface VoiceUserProps {
  tile: UserTile;
  large?: boolean;
}

export function VoiceUser({ tile, large }: VoiceUserProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const { participant } = tile;
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const isSpeaking = useVoiceStore((s) => s.speakingParticipantIds.has(participant.identity));
  const spaceMutedUserIds = useVoiceStore((s) => s.spaceMutedUserIds);
  const spaceDeafenedUserIds = useVoiceStore((s) => s.spaceDeafenedUserIds);
  const permissionMutedUserIds = useVoiceStore((s) => s.permissionMutedUserIds);
  const unwatchedCameras = useVoiceStore((s) => s.unwatchedCameras);
  const participantMutes = useVoiceStore((s) => s.participantMutes);
  const spaceId = useSpaceStore((s) => currentVoiceChannelId ? s.channelToSpaceMap.get(currentVoiceChannelId) : null);

  const openContextMenu = useContextMenuStore((s) => s.open);

  const [, forceUpdate] = useState(0);

  const isLocal = participant.isLocal;
  const avatarUserId = participant.homeUserId ?? participant.userId;
  const { displayName, avatar, user } = useVoiceParticipantMeta(participant);

  // --- VIDEO & UI ---

  const activeVideoTrack = tile.videoTrack;
  const hasVideo = activeVideoTrack !== null;

  // Force re-render when tracks end/mute
  useEffect(() => {
    if (!tile.videoTrack) return;
    const onEnded = () => forceUpdate((n) => n + 1);
    tile.videoTrack.addEventListener('ended', onEnded);
    return () => tile.videoTrack?.removeEventListener('ended', onEnded);
  }, [tile.videoTrack]);

  // Attach Video — use LiveKit's track.attach() to register the element
  // with the adaptive stream observer (enables SFU layer switching by viewport size)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const lkTrack = tile.lkVideoTrack;
    if (lkTrack) {
      lkTrack.attach(videoEl);
      return () => { lkTrack.detach(videoEl); };
    } else {
      videoEl.srcObject = null;
    }
  }, [tile.lkVideoTrack]);

  // Context Menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const position = { x: e.clientX, y: e.clientY };
      const channelId = currentVoiceChannelId ?? useVoiceStore.getState().activeDmCall?.dmChannelId ?? null;
      openContextMenu(position, buildVoiceParticipantMenuItems(participant.userId, channelId, position, user, isLocal));
    },
    [isLocal, currentVoiceChannelId, participant.userId, user, openContextMenu],
  );

  return (
    <div
      data-context-menu
      className={`relative bg-surface-base rounded-xl overflow-hidden flex items-center justify-center group transition-all duration-200 ${
        isSpeaking
          ? 'ring-[3px] ring-status-online shadow-[0_0_12px_rgba(134,239,172,0.25)]'
          : 'ring-1 ring-white/[0.06] hover:ring-white/10'
      } h-full w-full`}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      aria-label={displayName}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = { x: rect.left + 12, y: rect.top + 12 };
        const channelId = currentVoiceChannelId ?? useVoiceStore.getState().activeDmCall?.dmChannelId ?? null;
        openContextMenu(position, buildVoiceParticipantMenuItems(participant.userId, channelId, position, user, isLocal));
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${large ? 'object-contain bg-black' : 'object-cover'}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-channel">
          <div className="relative flex">
            <Avatar
              src={avatar}
              name={displayName}
              size={large ? 100 : 64}
              userId={avatarUserId}
              user={user ?? undefined}
              onClick={() => {}}
              freezeAnimation={!isSpeaking}
            />
            {isSpeaking && (
              <div className="absolute -inset-1.5 rounded-full ring-[3px] ring-status-online animate-pulse" />
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-semibold text-white truncate ${large ? 'text-base' : 'text-[13px]'}`}
            >
              <ProfileName user={user}>{displayName}</ProfileName>
            </span>
            {isLocal && (
              <span className="text-[10px] text-white/40 font-medium">
                {uiText("(you)")}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {(() => {
              const isSpaceMutedUser = spaceId ? spaceMutedUserIds.has(`${spaceId}:${participant.userId}`) : false;
              const isSpaceDeafenedUser = spaceId ? spaceDeafenedUserIds.has(`${spaceId}:${participant.userId}`) : false;
              const isPermissionMutedUser = spaceId ? permissionMutedUserIds.has(`${spaceId}:${participant.userId}`) : false;
              const effectivelyMuted = participant.isMuted || isSpaceMutedUser || isSpaceDeafenedUser || isPermissionMutedUser;
              const effectivelyDeafened = (isLocal ? isDeafened : participant.isDeafened) || isSpaceDeafenedUser;
              return (
                <>
                  {effectivelyMuted && (
                    <VoiceStatusBadge name="mic" enforced={isSpaceMutedUser || isSpaceDeafenedUser || isPermissionMutedUser} />
                  )}
                  {effectivelyDeafened && (
                    <VoiceStatusBadge name="audio" enforced={isSpaceDeafenedUser} />
                  )}
                  {!isLocal && participant.isCameraOn && (
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H2c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        {unwatchedCameras.has(participant.userId) && (
                          <line x1="1" y1="1" x2="23" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        )}
                      </svg>
                    </div>
                  )}
                  {!isLocal && participantMutes.get(participant.userId) && (
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center" title={uiText("Locally Muted")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M3 9v6h4l5 5V4L7 9H3z" />
                        <line x1="17" y1="7" x2="23" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <line x1="23" y1="7" x2="17" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

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
import { OrbitalIcon } from '../ui/OrbitalIcon';
import { VoiceStatusBadge } from './VoiceStatusBadge';

interface VoiceUserProps {
  tile: UserTile;
  large?: boolean;
  compact?: boolean;
  compactAvatarSize?: number;
}

export function VoiceUser({ tile, large, compact = false, compactAvatarSize = 48 }: VoiceUserProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const { participant } = tile;
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const currentVoiceChannelId = useVoiceStore((s) => s.currentVoiceChannelId);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const speaking = useVoiceStore((s) => s.speakingParticipantIds.has(participant.identity));
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
  const hasVideo = !compact && activeVideoTrack !== null;
  const spaceKey = spaceId ? `${spaceId}:${participant.userId}` : '';
  const enforcedMute = spaceMutedUserIds.has(spaceKey) || permissionMutedUserIds.has(spaceKey);
  const enforcedDeafen = spaceDeafenedUserIds.has(spaceKey);
  const effectivelyDeafened = (isLocal ? isDeafened : participant.isDeafened) || enforcedDeafen;
  const effectivelyMuted = participant.isMuted || (isLocal && isMuted) || effectivelyDeafened || enforcedMute;
  const isSpeaking = speaking && !effectivelyMuted;
  const locallyMuted = !isLocal && !!participantMutes.get(participant.userId);
  const avatarContent = (
    <Avatar
      src={avatar}
      name={displayName}
      size={compact ? compactAvatarSize : large ? 100 : 64}
      userId={avatarUserId}
      user={user ?? undefined}
      onClick={compact && user ? undefined : () => {}}
      showDecoration
      animateDecoration={isSpeaking}
      className={isSpeaking && compact ? 'rounded-full ring-2 ring-status-online' : ''}
    />
  );

  // Force re-render when tracks end/mute
  useEffect(() => {
    if (!hasVideo || !tile.videoTrack) return;
    const onEnded = () => forceUpdate((n) => n + 1);
    tile.videoTrack.addEventListener('ended', onEnded);
    return () => tile.videoTrack?.removeEventListener('ended', onEnded);
  }, [hasVideo, tile.videoTrack]);

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
  }, [hasVideo, tile.lkVideoTrack]);

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
      className={compact
        ? 'lume-call-participant rounded-lg'
        : `relative bg-surface-base rounded-xl overflow-hidden flex items-center justify-center group transition-all duration-200 ${isSpeaking
          ? 'ring-[3px] ring-status-online shadow-[0_0_12px_rgba(134,239,172,0.25)]'
          : 'ring-1 ring-white/[0.06] hover:ring-white/10'} h-full w-full`}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      aria-label={isSpeaking ? uiText("{0} está falando", [displayName]) : displayName}
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
      {compact ? (
        <div className="relative flex">
          {avatarContent}
          {(effectivelyMuted || effectivelyDeafened) && (
            <div className="absolute -bottom-1 -right-1 z-[2] flex gap-0.5">
              {effectivelyMuted && <VoiceStatusBadge name="mic" enforced={enforcedMute || enforcedDeafen} />}
              {effectivelyDeafened && <VoiceStatusBadge name="audio" enforced={enforcedDeafen} />}
            </div>
          )}
        </div>
      ) : hasVideo ? (
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
            {avatarContent}
            {isSpeaking && (
              <div className="absolute -inset-1.5 rounded-full ring-[3px] ring-status-online animate-pulse" />
            )}
          </div>
        </div>
      )}

      {compact ? (
        <div className="max-w-full flex items-center justify-center gap-1 text-[11px] text-txt-secondary">
          <span className="truncate"><ProfileName user={user}>{displayName}</ProfileName></span>
          {participant.isCameraOn && <span title={uiText("Câmera ligada")}><OrbitalIcon name="video" size={13} /></span>}
          {participant.isScreenSharing && <span className="text-accent-rose font-semibold">{uiText("LIVE")}</span>}
          {locallyMuted && <span title={uiText("Locally Muted")}><OrbitalIcon name="audio" size={13} cut /></span>}
        </div>
      ) : (
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
              {effectivelyMuted && (
                <VoiceStatusBadge name="mic" enforced={enforcedMute || enforcedDeafen} />
              )}
              {effectivelyDeafened && (
                <VoiceStatusBadge name="audio" enforced={enforcedDeafen} />
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
              {locallyMuted && (
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center" title={uiText("Locally Muted")}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                    <path d="M3 9v6h4l5 5V4L7 9H3z" />
                    <line x1="17" y1="7" x2="23" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="23" y1="7" x2="17" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
